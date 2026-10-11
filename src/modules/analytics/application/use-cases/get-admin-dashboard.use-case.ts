import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

type DashboardRangeKey = 'today' | '7d' | '30d' | 'month';
const MAX_DASHBOARD_SOURCE_ROWS = 5000;
const MAX_DASHBOARD_MATERIALIZED_ROWS = 50000;
const MAX_DASHBOARD_ORDER_ITEMS = 20;
const MAX_DASHBOARD_PAYMENTS = 10;
const MAX_DASHBOARD_SHIPMENTS = 10;
const MAX_DASHBOARD_VARIANTS = 10;
const MAX_DASHBOARD_INVENTORY_ITEMS = 10;
type ModuleStatus =
  | 'READY'
  | 'GO_WITH_RISKS'
  | 'PARTIAL'
  | 'BLOCKED_PROVIDER'
  | 'BLOCKED_CONFIGURATION'
  | 'MOCK_ONLY'
  | 'NO_GO';

interface DashboardRange {
  key: DashboardRangeKey;
  label: string;
  from: string;
  to: string;
}

interface ModuleReadiness {
  key: string;
  label: string;
  status: ModuleStatus;
  blockers: string[];
  href: string;
}

interface AlertItem {
  severity: 'critical' | 'warning' | 'info';
  module: string;
  message: string;
  actionLabel: string;
  href: string;
  status: ModuleStatus | string;
  createdAt: string;
}

interface QuickActionItem {
  label: string;
  href: string;
  permission: string;
  status: 'enabled' | 'disabled';
  reason: string | null;
}

type OrderWithDashboardRelations = Prisma.OrderGetPayload<{
  include: {
    orderItems: true;
    payments: true;
    shipments: true;
  };
}>;

type ProductWithDashboardRelations = Prisma.ProductGetPayload<{
  include: {
    variants: {
      include: {
        inventoryItems: true;
      };
    };
  };
}>;

@Injectable()
export class GetAdminDashboardUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async execute(actor: CurrentUser, rangeKey?: string) {
    assertHasPermissions(actor.permissions, ['dashboard.read']);
    const financialAllowed = actor.permissions.includes('reports.financial.read');
    const auditAllowed = actor.permissions.includes('audit.read');

    const range = this.resolveRange(rangeKey);
    const from = new Date(range.from);
    const to = new Date(range.to);
    const nowIso = new Date().toISOString();
    return this.prisma.$transaction(async (tx) => {
    await this.assertMaterializationBudget(tx, from, to);

    const [
      periodOrders,
      todayOrdersCount,
      allOrders,
      products,
      customersCount,
      customersWithOrders,
      newCustomersCount,
      notificationsByStatus,
      recentOrders,
      recentPayments,
      recentAudit,
      failedNotifications,
      auditEventsCount,
      shipmentsInPeriod,
    ] = await Promise.all([
      tx.order.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: {
          orderItems: { orderBy: [{ id: 'asc' }], take: MAX_DASHBOARD_ORDER_ITEMS + 1 },
          payments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_DASHBOARD_PAYMENTS + 1 },
          shipments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_DASHBOARD_SHIPMENTS + 1 },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_DASHBOARD_SOURCE_ROWS + 1,
      }),
      tx.order.count({
        where: { createdAt: { gte: this.startOfToday(), lte: new Date() } },
      }),
      tx.order.findMany({
        where: { status: { notIn: [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.delivered] } },
        include: {
          orderItems: { orderBy: [{ id: 'asc' }], take: MAX_DASHBOARD_ORDER_ITEMS + 1 },
          payments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_DASHBOARD_PAYMENTS + 1 },
          shipments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_DASHBOARD_SHIPMENTS + 1 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_DASHBOARD_SOURCE_ROWS + 1,
      }),
      tx.product.findMany({
        include: {
          variants: {
            include: {
              inventoryItems: { orderBy: [{ id: 'asc' }], take: MAX_DASHBOARD_INVENTORY_ITEMS + 1 },
            },
            orderBy: [{ id: 'asc' }],
            take: MAX_DASHBOARD_VARIANTS + 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_DASHBOARD_SOURCE_ROWS + 1,
      }),
      tx.customer.count(),
      tx.customer.count({ where: { lastOrderAt: { not: null } } }),
      tx.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
      tx.notification.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      tx.order.findMany({
        include: {
          payments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_DASHBOARD_PAYMENTS + 1 },
          shipments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_DASHBOARD_SHIPMENTS + 1 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      tx.payment.findMany({
        select: {
          id: true,
          orderId: true,
          status: true,
          gateway: true,
          amount: true,
          currency: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      auditAllowed ? tx.auditLog.findMany({
        select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }) : Promise.resolve([]),
      tx.notification.findMany({
        where: { status: 'failed' },
        select: { eventName: true, eventId: true, lastError: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      auditAllowed ? tx.auditLog.count({
        where: { createdAt: { gte: from, lte: to } },
      }) : Promise.resolve(0),
      tx.shipment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_DASHBOARD_SOURCE_ROWS + 1,
      }),
    ]);

    if ([periodOrders, allOrders, products, shipmentsInPeriod].some((rows) => rows.length > MAX_DASHBOARD_SOURCE_ROWS)) {
      throw new PayloadTooLargeException('El rango o el volumen operativo supera el límite del dashboard. Reduzca el rango o revise los módulos por separado.');
    }
    const hasOversizedRelations = [...periodOrders, ...allOrders].some((order) =>
      order.orderItems.length > MAX_DASHBOARD_ORDER_ITEMS ||
      order.payments.length > MAX_DASHBOARD_PAYMENTS ||
      order.shipments.length > MAX_DASHBOARD_SHIPMENTS,
    ) || recentOrders.some((order) =>
      order.payments.length > MAX_DASHBOARD_PAYMENTS ||
      order.shipments.length > MAX_DASHBOARD_SHIPMENTS,
    ) || products.some((product) => product.variants.length > MAX_DASHBOARD_VARIANTS ||
      product.variants.some((variant) => variant.inventoryItems.length > MAX_DASHBOARD_INVENTORY_ITEMS),
    );
    if (hasOversizedRelations) {
      throw new PayloadTooLargeException('Una relación supera el límite operativo del dashboard. Revise el módulo correspondiente.');
    }

    const readinessModules = this.buildReadinessModules();
    const readinessCounts = this.countReadiness(readinessModules);
    const readiness = {
      globalStatus: this.globalReadinessStatus(readinessModules),
      counts: readinessCounts,
      modules: readinessModules,
      blockedModules: readinessModules.filter((module) =>
        ['BLOCKED_PROVIDER', 'BLOCKED_CONFIGURATION', 'MOCK_ONLY', 'NO_GO'].includes(module.status),
      ),
    };

    const notificationStatusCounts = Object.fromEntries(
      notificationsByStatus.map((row) => [row.status, row._count.status]),
    ) as Partial<Record<string, number>>;
    const inventory = this.computeInventory(products);
    const ordersWithoutGuide = allOrders.filter((order) => this.orderNeedsGuide(order));
    const periodOrdersWithAlerts = periodOrders.filter((order) =>
      this.orderNeedsGuide(order) ||
      order.payments.some((payment) => payment.status === PaymentStatus.rejected || payment.status === PaymentStatus.expired),
    );
    const periodPayments = periodOrders.flatMap((order) => order.payments);
    const totalSalesAmount = periodOrders.reduce(
      (sum, order) => sum + Number(order.grandTotal),
      0,
    );
    const orderCount = periodOrders.length;
    const averageOrderValue = orderCount > 0 ? totalSalesAmount / orderCount : 0;
    const pendingPayments = periodPayments.filter((payment) => payment.status === PaymentStatus.pending).length;
    const paidPayments = periodPayments.filter((payment) => payment.status === PaymentStatus.approved).length;
    const failedPayments = periodPayments.filter((payment) =>
      payment.status === PaymentStatus.rejected || payment.status === PaymentStatus.expired,
    ).length;
    const codPendingReconciliation = periodPayments.filter(
      (payment) => payment.gateway === 'cash_on_delivery' && payment.status === PaymentStatus.pending,
    ).length;
    const mockGuidesCount = shipmentsInPeriod.filter((shipment) =>
      shipment.provider === 'mock_99envios' ||
      shipment.trackingNumber?.startsWith('MOCK99') ||
      shipment.providerShipmentId?.startsWith('MOCK99'),
    ).length;
    const realGuidesCount = shipmentsInPeriod.filter((shipment) =>
      shipment.provider === '99envios' &&
      !shipment.trackingNumber?.startsWith('MOCK99') &&
      !shipment.providerShipmentId?.startsWith('MOCK99'),
    ).length;

    const alerts = this.buildAlerts({
      nowIso,
      readinessModules,
      ordersWithoutGuide: ordersWithoutGuide.length,
      pendingPayments,
      codPendingReconciliation,
      outOfStockProducts: inventory.outOfStockProducts,
      lowStockProducts: inventory.lowStockProducts,
      incompleteProducts: inventory.incompleteProducts,
      missingCostProducts: inventory.missingCostProducts,
      failedNotifications: notificationStatusCounts.failed ?? 0,
    });

    return {
      range,
      refreshedAt: nowIso,
      readiness,
      kpis: {
        sales: {
          totalSalesAmount: financialAllowed ? this.money(totalSalesAmount) : 'NO_PERMISSION',
          orderCount,
          averageOrderValue: financialAllowed ? this.money(averageOrderValue) : 'NO_PERMISSION',
          ordersToday: todayOrdersCount,
          pendingOrders: periodOrders.filter((order) =>
            ([OrderStatus.draft, OrderStatus.pending_payment] as OrderStatus[]).includes(order.status),
          ).length,
          confirmedOrders: periodOrders.filter((order) =>
            ([OrderStatus.paid, OrderStatus.packed, OrderStatus.shipped, OrderStatus.delivered] as OrderStatus[]).includes(order.status),
          ).length,
          cancelledOrders: periodOrders.filter((order) =>
            ([OrderStatus.cancelled, OrderStatus.refunded] as OrderStatus[]).includes(order.status),
          ).length,
          ordersWithoutGuide: ordersWithoutGuide.length,
          ordersWithAlerts: periodOrdersWithAlerts.length,
        },
        payments: {
          pendingPayments,
          paidPayments,
          failedPayments,
          manualReviewPayments: 0,
          codPendingReconciliation,
          paymentProviderStatus: this.paymentProviderStatus(),
        },
        inventory: {
          ...inventory,
          inventoryReadiness: 'READY',
        },
        shipping: {
          shipmentsCreated: shipmentsInPeriod.length,
          shipmentsPendingGuide: ordersWithoutGuide.length,
          autoShippingFailed: shipmentsInPeriod.filter((shipment) =>
            String(shipment.rawProviderStatus ?? '').includes('failed'),
          ).length,
          shippingProviderStatus: this.shippingProviderStatus(),
          mockGuidesCount,
          realGuidesCount,
          trackingPublicStatus: 'GO_WITH_RISKS',
        },
        customers: {
          totalCustomers: customersCount,
          customersWithOrders,
          newCustomersInPeriod: newCustomersCount,
        },
        notifications: {
          queuedNotifications: notificationStatusCounts.queued ?? 0,
          sentNotifications: notificationStatusCounts.sent ?? 0,
          failedNotifications: notificationStatusCounts.failed ?? 0,
          pendingProviderNotifications:
            notificationStatusCounts.pending_provider ??
            notificationStatusCounts.pending ??
            0,
        },
        system: {
          globalReadinessStatus: readiness.globalStatus,
          blockedModulesCount: readiness.blockedModules.length,
          partialModulesCount: (readinessCounts.PARTIAL ?? 0) + (readinessCounts.GO_WITH_RISKS ?? 0),
          readyModulesCount: readinessCounts.READY ?? 0,
          productionBlockersCount: readiness.blockedModules.length,
          lastAuditEventsCount: auditAllowed ? auditEventsCount : 'NO_PERMISSION',
        },
      },
      charts: {
        salesByDay: this.salesByDay(periodOrders, from, to).map((row) => ({
          ...row,
          amount: financialAllowed ? row.amount : 'NO_PERMISSION',
        })),
        ordersByStatus: this.countByStatus(periodOrders.map((order) => order.status)),
        paymentsByStatus: this.countByStatus(periodPayments.map((payment) => payment.status)),
        inventoryByStatus: [
          { label: 'Sin stock', value: inventory.outOfStockProducts, status: 'critical' },
          { label: 'Bajo stock', value: inventory.lowStockProducts, status: 'warning' },
          { label: 'Saludable', value: inventory.healthyStockProducts, status: 'ready' },
          { label: 'Incompleto', value: inventory.incompleteProducts, status: 'partial' },
        ],
        readinessByStatus: Object.entries(readinessCounts).map(([label, value]) => ({
          label,
          value,
        })),
      },
      alerts,
      quickActions: this.buildQuickActions(actor.permissions, {
        paymentProviderStatus: this.paymentProviderStatus(),
        shippingProviderStatus: this.shippingProviderStatus(),
      }),
      recentActivity: {
        auditAccessStatus: auditAllowed ? 'GRANTED' : 'NO_PERMISSION',
        orders: recentOrders.map((order) => ({
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.payments[0]?.status ?? 'pending',
          shippingStatus: order.shipments[0]?.status ?? 'pending_provider',
          total: financialAllowed ? this.money(Number(order.grandTotal)) : 'NO_PERMISSION',
          createdAt: order.createdAt.toISOString(),
          href: `/admin/pedidos?search=${encodeURIComponent(order.orderNumber)}`,
        })),
        payments: recentPayments.map((payment) => ({
          orderNumber: payment.order.orderNumber,
          status: payment.status,
          method: payment.gateway,
          amount: financialAllowed ? this.money(Number(payment.amount)) : 'NO_PERMISSION',
          createdAt: payment.createdAt.toISOString(),
          href: `/admin/pagos?search=${encodeURIComponent(payment.order.orderNumber)}`,
        })),
        audit: recentAudit.map((entry) => ({
          actor: entry.actor?.email ? this.maskEmail(entry.actor.email) : 'sistema',
          module: entry.entityType,
          action: entry.action,
          createdAt: entry.createdAt.toISOString(),
          href: `/admin/auditoria?entity=${encodeURIComponent(entry.entityType)}`,
        })),
        failedNotifications: failedNotifications.map((notification) => ({
          type: notification.eventName,
          reference: notification.eventId,
          reason: notification.lastError ? this.safeMessage(notification.lastError) : 'Sin detalle proveedor',
          createdAt: notification.createdAt.toISOString(),
          href: '/admin/notificaciones?status=failed',
        })),
      },
    };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async assertMaterializationBudget(tx: Prisma.TransactionClient, from: Date, to: Date): Promise<void> {
    const activeOrder = { status: { notIn: [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.delivered] } };
    const [periodOrders, periodItems, periodPayments, periodShipments, activeOrders, activeItems, activePayments,
      activeShipments, products, variants, inventoryItems] = await Promise.all([
      tx.order.count({ where: { createdAt: { gte: from, lte: to } } }),
      tx.orderItem.count({ where: { order: { createdAt: { gte: from, lte: to } } } }),
      tx.payment.count({ where: { order: { createdAt: { gte: from, lte: to } } } }),
      tx.shipment.count({ where: { createdAt: { gte: from, lte: to } } }),
      tx.order.count({ where: activeOrder }),
      tx.orderItem.count({ where: { order: activeOrder } }),
      tx.payment.count({ where: { order: activeOrder } }),
      tx.shipment.count({ where: { order: activeOrder } }),
      tx.product.count(),
      tx.variant.count(),
      tx.inventoryItem.count(),
    ]);
    const materializedRows = periodOrders + periodItems + periodPayments + periodShipments + activeOrders +
      activeItems + activePayments + activeShipments + products + variants + inventoryItems +
      5 * (MAX_DASHBOARD_PAYMENTS + MAX_DASHBOARD_SHIPMENTS + 1);
    if (materializedRows > MAX_DASHBOARD_MATERIALIZED_ROWS) {
      throw new PayloadTooLargeException('El volumen total supera el presupuesto del dashboard. Use reportes con un rango menor.');
    }
  }

  private resolveRange(rangeKey?: string): DashboardRange {
    const now = new Date();
    const from = new Date(now);
    let key: DashboardRangeKey = '30d';
    let label = 'Últimos 30 días';

    if (rangeKey === 'today') {
      key = 'today';
      label = 'Hoy';
      from.setHours(0, 0, 0, 0);
    } else if (rangeKey === '7d') {
      key = '7d';
      label = 'Últimos 7 días';
      from.setDate(from.getDate() - 7);
    } else if (rangeKey === 'month') {
      key = 'month';
      label = 'Mes actual';
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
    } else if (rangeKey === undefined || rangeKey === '30d') {
      from.setDate(from.getDate() - 30);
    } else {
      throw new BadRequestException('Rango de dashboard no permitido.');
    }

    return {
      key,
      label,
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }

  private startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private computeInventory(products: ProductWithDashboardRelations[]) {
    const activeProducts = products.filter((product) => product.isActive);
    const activeVariants = products.flatMap((product) =>
      product.variants.filter((variant) => variant.isActive),
    );
    const stockByProduct = activeProducts.map((product) => {
      const available = product.variants.reduce(
        (productTotal, variant) =>
          productTotal +
          variant.inventoryItems.reduce(
            (variantTotal, item) =>
              variantTotal + Math.max(item.onHandQty - item.reservedQty - item.committedQty, 0),
            0,
          ),
        0,
      );
      const hasSellableVariant = product.variants.some(
        (variant) => variant.isActive && variant.sku.trim() && Number(variant.price) > 0,
      );
      const hasCost = product.variants.some((variant) =>
        variant.inventoryItems.some((item) => item.costPrice !== null),
      );
      return { product, available, hasSellableVariant, hasCost };
    });

    const outOfStockProducts = stockByProduct.filter((entry) => entry.available <= 0).length;
    const lowStockProducts = stockByProduct.filter(
      (entry) => entry.available > 0 && entry.available <= 2,
    ).length;
    const incompleteProducts = stockByProduct.filter(
      (entry) => !entry.hasSellableVariant || entry.available <= 0,
    ).length;
    const sellableProducts = stockByProduct.filter(
      (entry) => entry.product.isActive && entry.hasSellableVariant && entry.available > 0,
    ).length;
    const missingCostProducts = stockByProduct.filter(
      (entry) => entry.available > 0 && !entry.hasCost,
    ).length;

    return {
      activeProducts: activeProducts.length,
      activeVariants: activeVariants.length,
      sellableProducts,
      incompleteProducts,
      outOfStockProducts,
      lowStockProducts,
      missingCostProducts,
      healthyStockProducts: Math.max(
        activeProducts.length - outOfStockProducts - lowStockProducts - incompleteProducts,
        0,
      ),
    };
  }

  private orderNeedsGuide(order: OrderWithDashboardRelations) {
    return (
      !([OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.delivered] as OrderStatus[]).includes(order.status) &&
      !order.shipments.some((shipment) =>
        Boolean(shipment.trackingNumber ?? shipment.providerShipmentId),
      )
    );
  }

  private salesByDay(orders: OrderWithDashboardRelations[], from: Date, to: Date) {
    const days = new Map<string, { date: string; amount: number; orders: number }>();
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end && days.size < 45) {
      const date = cursor.toISOString().slice(0, 10);
      days.set(date, { date, amount: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      const entry = days.get(date) ?? { date, amount: 0, orders: 0 };
      entry.amount += Number(order.grandTotal);
      entry.orders += 1;
      days.set(date, entry);
    }

    return Array.from(days.values()).map((entry) => ({
      ...entry,
      amount: Number(entry.amount.toFixed(2)),
    }));
  }

  private countByStatus(statuses: string[]) {
    const counts = statuses.reduce<Record<string, number>>((accumulator, status) => {
      accumulator[status] = (accumulator[status] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }

  private buildReadinessModules(): ModuleReadiness[] {
    const shippingProvider = process.env.SHIPPING_PROVIDER ?? 'internal';
    const authDisabled = process.env.ADMIN_AUTH_DISABLED === 'true';
    const appEnv = process.env.APP_ENV ?? 'local';
    const stableDomainConfigured = Boolean(process.env.PUBLIC_APP_URL) &&
      !String(process.env.PUBLIC_APP_URL).includes('trycloudflare');
    const has99Credentials = Boolean(
      process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL &&
      process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD &&
      process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE,
    );
    const emailReady = process.env.NOTIFICATIONS_REAL_PROVIDER_ENABLED === 'true' &&
      Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
    const paymentsReady = process.env.PAYMENTS_REAL_PROVIDER_ENABLED === 'true';

    return [
      this.module('dashboard', 'Dashboard', 'READY', [], '/admin/dashboard'),
      this.module('reports', 'Reportes', 'READY', [], '/admin/reportes'),
      this.module('catalog', 'Catálogo', 'GO_WITH_RISKS', ['Precios avanzados y contenido parcial.'], '/admin/productos'),
      this.module('inventory', 'Inventario', 'READY', [], '/admin/inventario'),
      this.module('orders', 'Pedidos', 'READY', [], '/admin/pedidos'),
      this.module('payments', 'Pagos', paymentsReady ? 'READY' : 'BLOCKED_PROVIDER', paymentsReady ? [] : ['Falta proveedor real de pagos/PSE.'], '/admin/pagos'),
      this.module('shipping', 'Envíos', has99Credentials && shippingProvider === '99envios' ? 'GO_WITH_RISKS' : shippingProvider === 'mock_99envios' ? 'MOCK_ONLY' : 'BLOCKED_PROVIDER', has99Credentials && shippingProvider === '99envios' ? ['Pendiente validación real completa de salida.'] : ['Faltan credenciales reales/sandbox de 99 Envíos.'], '/admin/envios'),
      this.module('tracking', 'Rastreo', 'GO_WITH_RISKS', ['Tracking interno operativo; tracking externo directo no documentado.'], '/admin/rastreo'),
      this.module('notifications', 'Notificaciones', emailReady ? 'READY' : 'BLOCKED_PROVIDER', emailReady ? [] : ['Email productivo pendiente; local/test no es producción.'], '/admin/notificaciones'),
      this.module('settings', 'Configuración', appEnv === 'production' && !authDisabled && stableDomainConfigured ? 'GO_WITH_RISKS' : 'BLOCKED_CONFIGURATION', ['Dominio estable, providers y auth producción deben quedar verdes.'], '/admin/configuracion'),
      this.module('security', 'Seguridad', authDisabled && appEnv === 'production' ? 'NO_GO' : 'READY', authDisabled && appEnv === 'production' ? ['ADMIN_AUTH_DISABLED no puede estar activo en producción.'] : [], '/admin/roles'),
    ];
  }

  private module(
    key: string,
    label: string,
    status: ModuleStatus,
    blockers: string[],
    href: string,
  ): ModuleReadiness {
    return { key, label, status, blockers, href };
  }

  private countReadiness(modules: ModuleReadiness[]) {
    return modules.reduce<Record<ModuleStatus, number>>((accumulator, module) => {
      accumulator[module.status] = (accumulator[module.status] ?? 0) + 1;
      return accumulator;
    }, {} as Record<ModuleStatus, number>);
  }

  private globalReadinessStatus(modules: ModuleReadiness[]): ModuleStatus {
    if (modules.some((module) => module.status === 'NO_GO')) return 'NO_GO';
    if (modules.some((module) => module.status === 'BLOCKED_CONFIGURATION')) return 'BLOCKED_CONFIGURATION';
    if (modules.some((module) => module.status === 'BLOCKED_PROVIDER')) return 'BLOCKED_PROVIDER';
    if (modules.some((module) => module.status === 'MOCK_ONLY')) return 'MOCK_ONLY';
    if (modules.some((module) => module.status === 'PARTIAL' || module.status === 'GO_WITH_RISKS')) return 'GO_WITH_RISKS';
    return 'READY';
  }

  private buildAlerts(input: {
    nowIso: string;
    readinessModules: ModuleReadiness[];
    ordersWithoutGuide: number;
    pendingPayments: number;
    codPendingReconciliation: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    incompleteProducts: number;
    missingCostProducts: number;
    failedNotifications: number;
  }): AlertItem[] {
    const alerts: AlertItem[] = [];

    for (const module of input.readinessModules.filter((entry) =>
      ['BLOCKED_PROVIDER', 'BLOCKED_CONFIGURATION', 'MOCK_ONLY', 'NO_GO'].includes(entry.status),
    )) {
      alerts.push({
        severity: module.status === 'NO_GO' || module.status === 'BLOCKED_CONFIGURATION' ? 'critical' : 'warning',
        module: module.label,
        message: module.blockers[0] ?? `${module.label} bloqueado.`,
        actionLabel: 'Revisar',
        href: module.href,
        status: module.status,
        createdAt: input.nowIso,
      });
    }

    this.pushAlert(alerts, input.ordersWithoutGuide, 'warning', 'Envíos', 'pedidos sin guía', 'Ver pedidos sin guía', '/admin/envios', input.nowIso);
    this.pushAlert(alerts, input.pendingPayments + input.codPendingReconciliation, 'warning', 'Pagos', 'pagos pendientes por conciliar', 'Ver pagos', '/admin/pagos', input.nowIso);
    this.pushAlert(alerts, input.outOfStockProducts, 'critical', 'Inventario', 'productos sin stock', 'Ver inventario', '/admin/inventario?filter=out_of_stock', input.nowIso);
    this.pushAlert(alerts, input.lowStockProducts, 'warning', 'Inventario', 'productos con bajo stock', 'Ver bajo stock', '/admin/inventario?filter=low_stock', input.nowIso);
    this.pushAlert(alerts, input.failedNotifications, 'warning', 'Notificaciones', 'notificaciones fallidas', 'Ver fallidas', '/admin/notificaciones?status=failed', input.nowIso);
    this.pushAlert(alerts, input.incompleteProducts, 'info', 'Catálogo', 'productos incompletos', 'Ver productos', '/admin/productos?filter=incomplete', input.nowIso);
    this.pushAlert(alerts, input.missingCostProducts, 'info', 'Inventario', 'productos con stock sin costo', 'Ver valorización', '/admin/inventario?tab=valuation', input.nowIso);

    return alerts.slice(0, 10);
  }

  private pushAlert(
    alerts: AlertItem[],
    count: number,
    severity: AlertItem['severity'],
    module: string,
    description: string,
    actionLabel: string,
    href: string,
    createdAt: string,
  ) {
    if (count <= 0) return;
    alerts.push({
      severity,
      module,
      message: `${count} ${description}.`,
      actionLabel,
      href,
      status: severity === 'critical' ? 'NO_GO' : severity === 'warning' ? 'GO_WITH_RISKS' : 'PARTIAL',
      createdAt,
    });
  }

  private buildQuickActions(
    permissions: string[],
    providerState: { paymentProviderStatus: string; shippingProviderStatus: string },
  ): QuickActionItem[] {
    const has = (permission: string) => permissions.includes(permission);
    const action = (
      label: string,
      href: string,
      permission: string,
      enabled: boolean,
      reason: string | null = null,
    ): QuickActionItem => ({
      label,
      href,
      permission,
      status: has(permission) && enabled ? 'enabled' : 'disabled',
      reason: !has(permission) ? `Requiere ${permission}` : reason,
    });

    return [
      action('Ver pedidos pendientes', '/admin/pedidos?status=pending_payment', 'orders.read', true),
      action('Ver pagos pendientes', '/admin/pagos?status=pending', 'payments.read', true),
      action('Ver pedidos sin guía', '/admin/envios?status=pending_guide', 'shipping.read', true),
      action('Ver productos sin stock', '/admin/inventario?filter=out_of_stock', 'inventory.read', true),
      action('Ver notificaciones fallidas', '/admin/notificaciones?status=failed', 'notifications.read', true),
      action('Ver readiness producción', '/admin/configuracion', 'settings.read', true),
      action('Ver auditoría reciente', '/admin/auditoria', 'audit.read', true),
      action('Crear producto', '/admin/productos/nuevo', 'products.write', true),
      action(
        'Registrar pago manual',
        '/admin/pagos?action=manual',
        'payments.write',
        providerState.paymentProviderStatus !== 'BLOCKED_PROVIDER',
        'Pagos reales bloqueados por provider.',
      ),
      action(
        'Reintentar envío',
        '/admin/envios?action=retry',
        'shipping.retry',
        providerState.shippingProviderStatus !== 'BLOCKED_PROVIDER',
        '99 Envíos real pendiente de credenciales.',
      ),
    ];
  }

  private paymentProviderStatus() {
    return process.env.PAYMENTS_REAL_PROVIDER_ENABLED === 'true' ? 'READY' : 'BLOCKED_PROVIDER';
  }

  private shippingProviderStatus() {
    const provider = process.env.SHIPPING_PROVIDER ?? 'internal';
    if (provider === 'mock_99envios') return 'MOCK_ONLY';
    if (
      provider === '99envios' &&
      process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL &&
      process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD &&
      process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE
    ) {
      return 'GO_WITH_RISKS';
    }
    return 'BLOCKED_PROVIDER';
  }

  private money(value: number) {
    return value.toFixed(2);
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'usuario';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private safeMessage(message: string) {
    return /^[A-Z][A-Z0-9_-]{0,79}$/.test(message) ? message : '[DETAILS_REDACTED]';
  }
}
