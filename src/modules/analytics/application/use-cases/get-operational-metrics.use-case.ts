import { Inject, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepository,
} from 'src/modules/analytics/domain/repositories/analytics.repository';

type CatalogProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    variants: { include: { inventoryItems: true; orderItems: true } };
    brand: true;
    category: true;
  };
}>;

@Injectable()
export class GetOperationalMetricsUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async execute(actor: CurrentUser) {
    assertHasPermissions(actor.permissions, ['dashboard.read']);

    const [
      orderStatusCounts,
      paymentStatusCounts,
      inventoryStatus,
      sales,
      products,
      orders,
      customersCount,
      notifications,
      shipments,
      stockMovementsCount,
      auditCount,
    ] = await Promise.all([
      this.analyticsRepository.getOrderStatusCounts(),
      this.analyticsRepository.getPaymentStatusCounts(),
      this.analyticsRepository.getInventoryStatus(),
      this.analyticsRepository.getSalesSummary(),
      this.prisma.product.findMany({
        include: {
          brand: true,
          category: true,
          variants: {
            include: {
              inventoryItems: true,
              orderItems: true,
            },
          },
        },
      }),
      this.prisma.order.findMany({
        include: {
          orderItems: true,
          payments: true,
          shipments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count(),
      this.prisma.notification.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.shipment.findMany(),
      this.prisma.stockMovement.count(),
      this.prisma.auditLog.count(),
    ]);

    const activeProducts = products.filter((product) => product.isActive);
    const variants = products.flatMap((product) => product.variants);
    const activeVariants = variants.filter((variant) => variant.isActive);
    const totalProductsSold = orders.reduce(
      (sum, order) => sum + order.orderItems.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const productsWithoutVariants = activeProducts.filter(
      (product) => product.variants.length === 0,
    );
    const variantsWithoutSku = activeVariants.filter((variant) => !variant.sku.trim());
    const variantsWithoutPrice = activeVariants.filter((variant) => Number(variant.price) <= 0);
    const productStock = activeProducts.map((product) => ({
      product,
      available: product.variants.reduce(
        (sum, variant) =>
          sum +
          variant.inventoryItems.reduce(
            (variantSum, item) => variantSum + Math.max(item.onHandQty - item.reservedQty, 0),
            0,
          ),
        0,
      ),
      sold: product.variants.reduce(
        (sum, variant) =>
          sum + variant.orderItems.reduce((variantSum, item) => variantSum + item.quantity, 0),
        0,
      ),
    }));
    const productsWithoutStock = productStock.filter((entry) => entry.available <= 0);
    const lowStockProducts = productStock.filter(
      (entry) => entry.available > 0 && entry.available <= 2,
    );
    const productsWithoutImage = activeProducts.filter(
      (product) => !this.productHasApprovedImage(product.metadata),
    );
    const sellableProducts = productStock.filter(({ product, available }) =>
      product.isActive &&
      available > 0 &&
      product.variants.some(
        (variant) => variant.isActive && variant.sku.trim() && Number(variant.price) > 0,
      ),
    );
    const ordersPendingGuide = orders.filter((order) =>
      order.status !== OrderStatus.cancelled &&
      order.status !== OrderStatus.refunded &&
      order.status !== OrderStatus.delivered &&
      !order.shipments.some((shipment) => shipment.trackingNumber),
    );
    const ordersWithInternalTracking = orders.length;
    const notificationStatusCounts = Object.fromEntries(
      notifications.map((notification) => [
        notification.status,
        notification._count.status,
      ]),
    );
    const paymentMethodCounts = orders.reduce<Record<string, number>>((accumulator, order) => {
      const gateway = order.payments[0]?.gateway ?? 'pending_provider';
      accumulator[gateway] = (accumulator[gateway] ?? 0) + 1;
      return accumulator;
    }, {});
    const cityCounts = orders.reduce<Record<string, number>>((accumulator, order) => {
      const city = order.shippingCity || 'Sin ciudad';
      accumulator[city] = (accumulator[city] ?? 0) + 1;
      return accumulator;
    }, {});
    const topCities = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
    const topProducts = productStock
      .map(({ product, sold, available }) => ({
        productId: product.id,
        name: product.name,
        brand: product.brand?.name ?? null,
        category: product.category?.name ?? null,
        quantitySold: sold,
        availableStock: available,
      }))
      .filter((entry) => entry.quantitySold > 0)
      .sort((left, right) => right.quantitySold - left.quantitySold)
      .slice(0, 8);
    const conversionEventsPersisted = false;
    const recommendations = this.buildRecommendations({
      productsWithoutImage: productsWithoutImage.length,
      productsWithoutStock: productsWithoutStock.length,
      productsWithoutVariants: productsWithoutVariants.length,
      ordersPendingGuide: ordersPendingGuide.length,
      pendingNotifications: notificationStatusCounts.queued ?? 0,
      failedNotifications: notificationStatusCounts.failed ?? 0,
      conversionEventsPersisted,
    });

    return {
      orderStatusCounts,
      paymentStatusCounts,
      inventoryStatus,
      executive: {
        salesTotal: sales.netRevenue,
        orderCount: sales.orderCount,
        pendingOrders:
          (orderStatusCounts.draft ?? 0) +
          (orderStatusCounts.pending_payment ?? 0),
        confirmedOrders:
          (orderStatusCounts.paid ?? 0) +
          (orderStatusCounts.packed ?? 0) +
          (orderStatusCounts.shipped ?? 0) +
          (orderStatusCounts.delivered ?? 0),
        cancelledOrders:
          (orderStatusCounts.cancelled ?? 0) +
          (orderStatusCounts.refunded ?? 0),
        averageTicket:
          sales.orderCount > 0
            ? (Number(sales.netRevenue) / sales.orderCount).toFixed(2)
            : '0.00',
        productsSold: totalProductsSold,
        activeProducts: activeProducts.length,
        activeVariants: activeVariants.length,
        productsWithoutStock: productsWithoutStock.length,
        lowStockProducts: lowStockProducts.length,
        ordersPendingGuide: ordersPendingGuide.length,
        ordersWithInternalTracking,
        notificationsPending:
          (notificationStatusCounts.queued ?? 0) +
          (notificationStatusCounts.pending_provider ?? 0),
        notificationsFailed: notificationStatusCounts.failed ?? 0,
        customersCount,
        stockMovementsCount,
        auditEventsCount: auditCount,
      },
      catalogHealth: {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        sellableProducts: sellableProducts.length,
        sellableRate:
          activeProducts.length > 0
            ? Number(((sellableProducts.length / activeProducts.length) * 100).toFixed(2))
            : 0,
        productsWithoutVariants: productsWithoutVariants.length,
        variantsWithoutSku: variantsWithoutSku.length,
        variantsWithoutPrice: variantsWithoutPrice.length,
        productsWithoutStock: productsWithoutStock.length,
        lowStockProducts: lowStockProducts.length,
        productsWithoutImage: productsWithoutImage.length,
        incompleteProducts: [
          ...productsWithoutVariants,
          ...productsWithoutImage,
          ...productsWithoutStock.map((entry) => entry.product),
        ]
          .filter((product, index, collection) =>
            collection.findIndex((candidate) => candidate.id === product.id) === index,
          )
          .slice(0, 10)
          .map((product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            reasons: this.catalogReasons(product, productStock.find((entry) => entry.product.id === product.id)?.available ?? 0),
          })),
      },
      orderHealth: {
        totalOrders: orders.length,
        ordersPendingGuide: ordersPendingGuide.length,
        ordersWithCarrierGuide: shipments.filter((shipment) => shipment.trackingNumber).length,
        ordersWithInternalTracking,
        ordersByStatus: orderStatusCounts,
        paymentsByStatus: paymentStatusCounts,
        paymentMethods: paymentMethodCounts,
        topCities,
      },
      inventoryIntelligence: {
        totalTracked: inventoryStatus.totalTracked,
        lowStock: inventoryStatus.lowStock,
        withoutStock: productsWithoutStock.length,
        healthyStock: Math.max(activeProducts.length - productsWithoutStock.length - lowStockProducts.length, 0),
        topProducts,
        productsWithoutMovement: productStock
          .filter((entry) => entry.sold === 0)
          .slice(0, 10)
          .map((entry) => ({
            id: entry.product.id,
            name: entry.product.name,
            availableStock: entry.available,
          })),
      },
      conversion: {
        persistedEvents: conversionEventsPersisted,
        message:
          'No existe tabla persistente de eventos de navegación; se reportan conversiones confirmadas desde órdenes reales y el modelo queda marcado como pendiente.',
        checkoutCompleted: orders.length,
        checkoutFailed: 0,
      },
      notifications: {
        statusCounts: notificationStatusCounts,
      },
      recommendations,
      providerReadiness: {
        email: 'local/test',
        payments: {
          cashOnDelivery: true,
          pse: 'pending_provider',
        },
        shipping: {
          internalTracking: true,
          externalCarrier: 'pending_provider',
        },
      },
    };
  }

  private productHasApprovedImage(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }

    const image = (metadata as Record<string, unknown>).image;
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
      return false;
    }

    return (image as Record<string, unknown>).status === 'approved';
  }

  private catalogReasons(product: CatalogProductWithRelations, availableStock: number) {
    const reasons: string[] = [];
    if (product.variants.length === 0) reasons.push('Sin variante');
    if (!product.variants.some((variant) => variant.isActive && variant.sku.trim())) reasons.push('Sin SKU vendible');
    if (!product.variants.some((variant) => variant.isActive && Number(variant.price) > 0)) reasons.push('Sin precio vendible');
    if (availableStock <= 0) reasons.push('Sin stock disponible');
    if (!this.productHasApprovedImage(product.metadata)) reasons.push('Sin imagen aprobada');
    return reasons;
  }

  private buildRecommendations(input: {
    productsWithoutImage: number;
    productsWithoutStock: number;
    productsWithoutVariants: number;
    ordersPendingGuide: number;
    pendingNotifications: number;
    failedNotifications: number;
    conversionEventsPersisted: boolean;
  }) {
    const recommendations: Array<{
      severity: 'critical' | 'warning' | 'info';
      title: string;
      action: string;
      count?: number;
    }> = [];

    if (input.productsWithoutVariants > 0) {
      recommendations.push({
        severity: 'critical',
        title: 'Productos sin variante vendible',
        action: 'Completar variante, SKU, precio y stock antes de publicar.',
        count: input.productsWithoutVariants,
      });
    }
    if (input.productsWithoutStock > 0) {
      recommendations.push({
        severity: 'warning',
        title: 'Productos sin stock disponible',
        action: 'Asignar stock o retirar de compra pública hasta confirmar inventario.',
        count: input.productsWithoutStock,
      });
    }
    if (input.productsWithoutImage > 0) {
      recommendations.push({
        severity: 'info',
        title: 'Productos sin imagen aprobada',
        action: 'Subir o aprobar imagen para mejorar conversión sin inventar assets.',
        count: input.productsWithoutImage,
      });
    }
    if (input.ordersPendingGuide > 0) {
      recommendations.push({
        severity: 'warning',
        title: 'Pedidos pendientes de guía externa',
        action: 'Conectar transportadora o registrar guía real manualmente cuando exista.',
        count: input.ordersPendingGuide,
      });
    }
    if (input.failedNotifications > 0 || input.pendingNotifications > 0) {
      recommendations.push({
        severity: input.failedNotifications > 0 ? 'warning' : 'info',
        title: 'Notificaciones requieren revisión',
        action: 'Revisar cola local/test y activar proveedor productivo solo con credenciales reales.',
        count: input.failedNotifications + input.pendingNotifications,
      });
    }
    if (!input.conversionEventsPersisted) {
      recommendations.push({
        severity: 'info',
        title: 'Eventos de navegación pendientes',
        action: 'Persistir eventos anónimos para medir add-to-cart, búsquedas y abandono sin PII.',
      });
    }
    recommendations.push({
      severity: 'info',
      title: 'Integraciones productivas pendientes',
      action: 'Email real, PSE, transportadora y dominio estable se conectan al cierre final.',
    });

    return recommendations;
  }
}
