import { BadRequestException, ForbiddenException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { csvCell } from 'src/modules/analytics/application/services/csv-cell-sanitizer';

const MAX_REPORT_SOURCE_ROWS = 5000;
const MAX_REPORT_MATERIALIZED_ROWS = 50000;
const MAX_REPORT_ORDER_ITEMS = 20;
const MAX_REPORT_PAYMENTS = 10;
const MAX_REPORT_SHIPMENTS = 10;
const MAX_REPORT_VARIANTS = 10;
const MAX_REPORT_INVENTORY_ITEMS = 10;

type RangeKey = 'today' | '7d' | '30d' | 'month';
type ModuleStatus =
  | 'READY'
  | 'GO_WITH_RISKS'
  | 'PARTIAL'
  | 'BLOCKED_PROVIDER'
  | 'BLOCKED_CONFIGURATION'
  | 'MOCK_ONLY'
  | 'NO_GO';
type ReportType =
  | 'summary'
  | 'sales'
  | 'orders'
  | 'payments'
  | 'inventory'
  | 'shipping'
  | 'notifications'
  | 'readiness'
  | 'audit';

interface ReportQuery {
  range?: string;
  status?: string;
  module?: string;
  paymentStatus?: string;
  shippingStatus?: string;
}

interface ExportQuery extends ReportQuery {
  type?: string;
  format?: string;
  includePii?: boolean;
}

type OrderForReports = Prisma.OrderGetPayload<{
  select: {
    id: true;
    orderNumber: true;
    status: true;
    grandTotal: true;
    createdAt: true;
    orderItems: {
      select: {
        variantId: true;
        variantNameSnapshot: true;
        skuSnapshot: true;
        quantity: true;
        lineGrandTotal: true;
        variant: {
          select: {
            product: { select: { name: true } };
          };
        };
      };
    };
    payments: { select: { status: true; gateway: true; amount: true; createdAt: true } };
    shipments: { select: { status: true; trackingNumber: true; providerShipmentId: true } };
  };
}>;

type ProductForReports = Prisma.ProductGetPayload<{
  select: {
    name: true;
    isActive: true;
    brand: { select: { name: true } };
    category: { select: { name: true } };
    variants: {
      select: {
        id: true;
        sku: true;
        isActive: true;
        price: true;
        inventoryItems: {
          select: { onHandQty: true; reservedQty: true; committedQty: true; costPrice: true };
        };
      };
    };
  };
}>;

type ShipmentForReports = Prisma.ShipmentGetPayload<{
  select: {
    id: true;
    createdAt: true;
    status: true;
    provider: true;
    trackingNumber: true;
    providerShipmentId: true;
    order: { select: { orderNumber: true } };
  };
}>;

type FailedNotificationForReports = Prisma.NotificationGetPayload<{
  select: {
    eventName: true;
    status: true;
    provider: true;
    attempts: true;
    lastError: true;
    createdAt: true;
  };
}>;

@Injectable()
export class GetAdminReportsUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async execute(actor: CurrentUser, query: ReportQuery = {}) {
    return this.readReport(actor, query, false);
  }

  private async readReport(actor: CurrentUser, query: ReportQuery, auditForExport: boolean) {
    assertHasPermissions(actor.permissions, ['reports.read']);
    const auditAllowed = actor.permissions.includes('audit.read')
      || (auditForExport && actor.permissions.includes('audit.export'));

    this.validateQuery(query);
    const range = this.resolveRange(query.range);
    const from = new Date(range.from);
    const to = new Date(range.to);
    return this.prisma.$transaction(async (tx) => {
    await this.assertMaterializationBudget(tx, from, to);
    const [
      orders,
      products,
      notificationsByStatus,
      notificationsFailed,
      audit,
      shipments,
    ] = await Promise.all([
      tx.order.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          createdAt: true,
          orderItems: {
            select: {
              variantId: true,
              variantNameSnapshot: true,
              skuSnapshot: true,
              quantity: true,
              lineGrandTotal: true,
              variant: {
                select: {
                  product: { select: { name: true } },
                },
              },
            },
            orderBy: [{ id: 'asc' }],
            take: MAX_REPORT_ORDER_ITEMS + 1,
          },
          payments: {
            select: { status: true, gateway: true, amount: true, createdAt: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: MAX_REPORT_PAYMENTS + 1,
          },
          shipments: {
            select: { status: true, trackingNumber: true, providerShipmentId: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: MAX_REPORT_SHIPMENTS + 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_REPORT_SOURCE_ROWS + 1,
      }),
      tx.product.findMany({
        select: {
          name: true,
          isActive: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
          variants: {
            select: {
              id: true,
              sku: true,
              isActive: true,
              price: true,
              inventoryItems: {
                select: { onHandQty: true, reservedQty: true, committedQty: true, costPrice: true },
                orderBy: [{ id: 'asc' }],
                take: MAX_REPORT_INVENTORY_ITEMS + 1,
              },
            },
            orderBy: [{ id: 'asc' }],
            take: MAX_REPORT_VARIANTS + 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_REPORT_SOURCE_ROWS + 1,
      }),
      tx.notification.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      tx.notification.findMany({
        where: { status: 'failed', createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: { eventName: true, status: true, provider: true, attempts: true, lastError: true, createdAt: true },
      }),
      auditAllowed ? tx.auditLog.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(query.module ? { entityType: query.module } : {}),
        },
        select: {
          id: true, actor: { select: { email: true } }, action: true, entityType: true,
          entityId: true, createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 80,
      }) : Promise.resolve([]),
      tx.shipment.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(query.shippingStatus ? { status: query.shippingStatus as ShipmentStatus } : {}),
          ...(query.status || query.paymentStatus ? { order: {
            ...(query.status ? { status: query.status as OrderStatus } : {}),
            ...(query.paymentStatus ? { payments: { some: { status: query.paymentStatus as PaymentStatus } } } : {}),
          } } : {}),
        },
        select: {
          id: true, createdAt: true, status: true, provider: true, trackingNumber: true,
          providerShipmentId: true, order: { select: { orderNumber: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_REPORT_SOURCE_ROWS + 1,
      }),
    ]);

    if ([orders, products, shipments].some((rows) => rows.length > MAX_REPORT_SOURCE_ROWS)) {
      throw new PayloadTooLargeException('El rango supera el límite operativo del reporte. Reduzca el rango o aplique filtros.');
    }
    const hasOversizedRelations = orders.some((order) =>
      order.orderItems.length > MAX_REPORT_ORDER_ITEMS ||
      order.payments.length > MAX_REPORT_PAYMENTS ||
      order.shipments.length > MAX_REPORT_SHIPMENTS
    ) || products.some((product) => product.variants.some((variant) =>
      variant.inventoryItems.length > MAX_REPORT_INVENTORY_ITEMS,
    ));
    if (hasOversizedRelations || products.some((product) => product.variants.length > MAX_REPORT_VARIANTS)) {
      throw new PayloadTooLargeException('Una relación supera el límite operativo del reporte. Reduzca el rango o revise el catálogo.');
    }

    const filteredOrders = orders.filter((order) => {
      if (query.status && order.status !== query.status) return false;
      if (query.paymentStatus && !order.payments.some((payment) => payment.status === query.paymentStatus)) return false;
      if (query.shippingStatus && !order.shipments.some((shipment) => shipment.status === query.shippingStatus)) return false;
      return true;
    });
    const payments = filteredOrders.flatMap((order) =>
      order.payments.filter((payment) => !query.paymentStatus || payment.status === query.paymentStatus)
        .map((payment) => ({ ...payment, orderNumber: order.orderNumber })),
    );
    const readiness = this.buildReadiness();
    const inventory = this.buildInventoryReport(products);
    const sales = this.buildSalesReport(filteredOrders, actor.permissions, products);
    const ordersReport = this.buildOrdersReport(filteredOrders, actor.permissions);
    const paymentsReport = this.buildPaymentsReport(payments, actor.permissions);
    const shipping = this.buildShippingReport(filteredOrders, shipments, query.shippingStatus);
    const notifications = this.buildNotificationsReport(notificationsByStatus, notificationsFailed);
    const auditReport = this.buildAuditReport(audit, auditAllowed);
    const blockers = readiness.modules
      .filter((module) =>
        ['BLOCKED_PROVIDER', 'BLOCKED_CONFIGURATION', 'MOCK_ONLY', 'NO_GO'].includes(module.status),
      )
      .map((module) => ({
        module: module.label,
        status: module.status,
        blocker: module.blockers[0] ?? 'Bloqueado.',
        nextAction: module.nextAction,
        impact: module.productionImpact,
        href: module.href,
      }));

    return {
      range,
      filters: {
        status: query.status ?? null,
        module: query.module ?? null,
        paymentStatus: query.paymentStatus ?? null,
        shippingStatus: query.shippingStatus ?? null,
      },
      refreshedAt: new Date().toISOString(),
      summary: {
        totalSalesAmount: sales.kpis.totalSalesAmount,
        orderCount: sales.kpis.orderCount,
        averageOrderValue: sales.kpis.averageOrderValue,
        pendingPayments: paymentsReport.kpis.pendingPayments,
        ordersWithoutGuide: shipping.kpis.ordersWithoutGuide,
        nonSellableProducts: inventory.kpis.nonSellableProducts,
        failedNotifications: notifications.kpis.failedNotifications,
        productionBlockers: blockers.length,
        marginStatus: sales.kpis.marginStatus,
      },
      reports: {
        sales,
        orders: ordersReport,
        payments: paymentsReport,
        inventory,
        shipping,
        notifications,
        readiness,
        audit: auditReport,
        blockers,
      },
      export: {
        formats: ['csv', 'pdf'],
        maxRows: 1000,
        standardExportContainsPii: false,
        piiExportRequires: 'customers.read_sensitive',
        enabled: actor.permissions.includes('reports.export'),
      },
    };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async assertMaterializationBudget(tx: Prisma.TransactionClient, from: Date, to: Date): Promise<void> {
    const dateFilter = { createdAt: { gte: from, lte: to } };
    const [orders, orderItems, payments, orderShipments, products, variants, inventoryItems, shipments] = await Promise.all([
      tx.order.count({ where: dateFilter }),
      tx.orderItem.count({ where: { order: dateFilter } }),
      tx.payment.count({ where: { order: dateFilter } }),
      tx.shipment.count({ where: { order: dateFilter } }),
      tx.product.count(),
      tx.variant.count(),
      tx.inventoryItem.count(),
      tx.shipment.count({ where: dateFilter }),
    ]);
    const materializedRows = orders + orderItems + payments + orderShipments + products + variants + inventoryItems + shipments;
    if (materializedRows > MAX_REPORT_MATERIALIZED_ROWS) {
      throw new PayloadTooLargeException('El volumen total supera el presupuesto del reporte. Reduzca el rango o aplique filtros.');
    }
  }

  async buildExport(actor: CurrentUser, query: ExportQuery = {}) {
    assertHasPermissions(actor.permissions, ['reports.export']);
    this.validateQuery(query);
    if (query.includePii) {
      throw new ForbiddenException('La exportación de PII permanece deshabilitada por política.');
    }
    const type = this.reportType(query.type);
    if (['sales', 'payments', 'orders'].includes(type) && !actor.permissions.includes('reports.financial.read')) {
      throw new ForbiddenException('El reporte financiero requiere reports.financial.read.');
    }
    if (type === 'audit' && !actor.permissions.includes('audit.export')) {
      throw new ForbiddenException('Exportar auditoría requiere audit.export.');
    }

    const report = await this.readReport(actor, query, type === 'audit');
    const rows = this.exportRows(type, report).slice(0, 1000);
    const format = query.format ?? 'csv';
    return {
      type,
      rows,
      format,
      csv: this.toCsv(rows, {
        title: `DistriTools JL - reporte ${type}`,
        range: report.range.label,
        filters: report.filters,
        actor: this.maskEmail(actor.email),
      }),
      pdf: format === 'pdf'
        ? this.toPdf({
          title: `DistriTools JL - reporte ${type}`,
          range: report.range.label,
          generatedAt: new Date().toISOString(),
          actor: this.maskEmail(actor.email),
          filters: report.filters,
          summary: report.summary,
          rows,
        })
        : null,
      filters: report.filters,
      range: report.range,
    };
  }

  private buildSalesReport(orders: OrderForReports[], permissions: string[], products: ProductForReports[]) {
    const financialAllowed = permissions.includes('reports.financial.read');
    const totalSales = orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);
    const items = orders.flatMap((order) => order.orderItems);
    const costByVariant = new Map(products.flatMap((product) => product.variants.map((variant) => [
      variant.id,
      variant.inventoryItems.find((inventoryItem) => inventoryItem.costPrice !== null)?.costPrice ?? null,
    ] as const)));
    const missingCostLines = items.filter((item) =>
      costByVariant.get(item.variantId) == null,
    );
    const canCalculateMargin = financialAllowed && items.length > 0 && missingCostLines.length === 0;
    const totalCost = canCalculateMargin
      ? items.reduce((sum, item) => {
        const cost = Number(costByVariant.get(item.variantId) ?? 0);
        return sum + cost * item.quantity;
      }, 0)
      : null;
    const grossMargin = totalCost === null ? null : totalSales - totalCost;
    const productSales = new Map<string, { product: string; sku: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const key = item.variantId;
      const current = productSales.get(key) ?? {
        product: item.variant.product?.name ?? item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += Number(item.lineGrandTotal);
      productSales.set(key, current);
    }

    return {
      kpis: {
        totalSalesAmount: financialAllowed ? this.money(totalSales) : 'NO_PERMISSION',
        orderCount: orders.length,
        averageOrderValue: financialAllowed && orders.length > 0 ? this.money(totalSales / orders.length) : financialAllowed ? '0.00' : 'NO_PERMISSION',
        grossMargin: grossMargin === null ? 'NO_DATA' : this.money(grossMargin),
        marginStatus: missingCostLines.length > 0 ? 'MARGIN_UNAVAILABLE_MISSING_COSTS' : canCalculateMargin ? 'READY' : 'NO_DATA',
        missingCostLines: missingCostLines.length,
      },
      chart: this.salesByDay(orders).map((row) => ({
        ...row,
        amount: financialAllowed ? row.amount : 'NO_PERMISSION',
      })),
      rows: Array.from(productSales.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 20)
        .map((row) => ({
          product: row.product,
          sku: row.sku,
          quantity: row.quantity,
          revenue: financialAllowed ? this.money(row.revenue) : 'NO_PERMISSION',
        })),
      empty: orders.length === 0,
    };
  }

  private buildOrdersReport(orders: OrderForReports[], permissions: string[]) {
    const financialAllowed = permissions.includes('reports.financial.read');
    return {
      kpis: {
        totalOrders: orders.length,
        pendingOrders: orders.filter((order) =>
          ([OrderStatus.draft, OrderStatus.pending_payment] as OrderStatus[]).includes(order.status),
        ).length,
        confirmedOrders: orders.filter((order) =>
          ([OrderStatus.paid, OrderStatus.packed, OrderStatus.shipped, OrderStatus.delivered] as OrderStatus[]).includes(order.status),
        ).length,
        cancelledOrders: orders.filter((order) =>
          ([OrderStatus.cancelled, OrderStatus.refunded] as OrderStatus[]).includes(order.status),
        ).length,
      },
      chart: this.countValues(orders.map((order) => order.status)),
      rows: orders.slice(0, 80).map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.payments[0]?.status ?? 'NO_DATA',
        shippingStatus: order.shipments[0]?.status ?? 'NO_DATA',
        total: financialAllowed ? this.money(Number(order.grandTotal)) : 'NO_PERMISSION',
        createdAt: order.createdAt.toISOString(),
        href: `/admin/pedidos?search=${encodeURIComponent(order.orderNumber)}`,
      })),
      empty: orders.length === 0,
    };
  }

  private buildPaymentsReport(payments: Array<{
    status: PaymentStatus;
    gateway: string;
    amount: Prisma.Decimal;
    createdAt: Date;
    orderNumber: string;
  }>, permissions: string[]) {
    const financialAllowed = permissions.includes('reports.financial.read');
    return {
      kpis: {
        pendingPayments: payments.filter((payment) => payment.status === PaymentStatus.pending).length,
        approvedPayments: payments.filter((payment) => payment.status === PaymentStatus.approved).length,
        failedPayments: payments.filter((payment) =>
          ([PaymentStatus.rejected, PaymentStatus.expired] as PaymentStatus[]).includes(payment.status),
        ).length,
        codPendingReconciliation: payments.filter(
          (payment) => payment.gateway === 'cash_on_delivery' && payment.status === PaymentStatus.pending,
        ).length,
        providerStatus: 'BLOCKED_PROVIDER',
      },
      chart: this.countValues(payments.map((payment) => payment.status)),
      rows: payments.slice(0, 80).map((payment) => ({
        orderNumber: payment.orderNumber,
        status: payment.status,
        method: payment.gateway,
        amount: financialAllowed ? this.money(Number(payment.amount)) : 'NO_PERMISSION',
        createdAt: payment.createdAt.toISOString(),
      })),
      empty: payments.length === 0,
    };
  }

  private buildInventoryReport(products: ProductForReports[]) {
    const rows = products.flatMap((product) =>
      product.variants.length === 0 ? [{
        product: product.name, sku: 'NO_DATA', brand: product.brand?.name ?? 'Sin marca',
        category: product.category?.name ?? 'Sin categoría', availableStock: 0, status: 'PARTIAL',
        reasons: [...(!product.isActive ? ['Producto inactivo'] : []), 'Sin variantes'], missingCost: false,
      }] : product.variants.map((variant) => {
        const availableStock = variant.inventoryItems.reduce(
          (sum, item) => sum + Math.max(item.onHandQty - item.reservedQty - item.committedQty, 0),
          0,
        );
        const hasSku = Boolean(variant.sku.trim());
        const hasPrice = Number(variant.price) > 0;
        const hasCost = variant.inventoryItems.some((item) => item.costPrice !== null);
        const reasons = [
          !product.isActive ? 'Producto inactivo' : null,
          !variant.isActive ? 'Variante inactiva' : null,
          !hasSku ? 'Sin SKU' : null,
          !hasPrice ? 'Sin precio' : null,
          availableStock <= 0 ? 'Sin stock' : null,
          !hasCost && availableStock > 0 ? 'Costo faltante' : null,
        ].filter((reason): reason is string => Boolean(reason));
        return {
          product: product.name,
          sku: variant.sku,
          brand: product.brand?.name ?? 'Sin marca',
          category: product.category?.name ?? 'Sin categoría',
          availableStock,
          status: reasons.length ? 'PARTIAL' : 'READY',
          reasons,
          missingCost: !hasCost && availableStock > 0,
        };
      }),
    );

    return {
      kpis: {
        variants: products.reduce((total, product) => total + product.variants.length, 0),
        productsWithoutVariants: products.filter((product) => product.variants.length === 0).length,
        nonSellableProducts: rows.filter((row) => row.reasons.length > 0).length,
        outOfStockProducts: rows.filter((row) => row.availableStock <= 0).length,
        lowStockProducts: rows.filter((row) => row.availableStock > 0 && row.availableStock <= 2).length,
        missingCostProducts: rows.filter((row) => row.missingCost).length,
      },
      chart: [
        { label: 'Sin stock', value: rows.filter((row) => row.availableStock <= 0).length },
        { label: 'Bajo stock', value: rows.filter((row) => row.availableStock > 0 && row.availableStock <= 2).length },
        { label: 'Costo faltante', value: rows.filter((row) => row.missingCost).length },
        { label: 'Listo', value: rows.filter((row) => row.reasons.length === 0).length },
      ],
      rows: rows
        .filter((row) => row.reasons.length > 0 || row.availableStock <= 2)
        .slice(0, 80),
      empty: rows.length === 0,
    };
  }

  private buildShippingReport(orders: OrderForReports[], shipments: ShipmentForReports[], shippingStatus?: string) {
    const ordersWithoutGuide = orders.filter((order) =>
      !([OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.delivered] as OrderStatus[]).includes(order.status) &&
      !order.shipments.some((shipment) => shipment.trackingNumber || shipment.providerShipmentId),
    );
    // Missing-guide orders are derived operational work, not persisted shipment states.
    const visibleOrdersWithoutGuide = shippingStatus ? [] : ordersWithoutGuide;
    const issueStatuses = [ShipmentStatus.delivery_failed, ShipmentStatus.returned, ShipmentStatus.cancelled] as ShipmentStatus[];
    return {
      kpis: {
        ordersWithoutGuide: ordersWithoutGuide.length,
        shipmentsCreated: shipments.length,
        shipmentsWithIssue: shipments.filter((shipment) => issueStatuses.includes(shipment.status)).length,
        mockGuides: shipments.filter((shipment) =>
          shipment.provider === 'mock_99envios' ||
          shipment.trackingNumber?.startsWith('MOCK99') ||
          shipment.providerShipmentId?.startsWith('MOCK99'),
        ).length,
        providerStatus: this.shippingProviderStatus(),
      },
      chart: this.countValues(shipments.map((shipment) => shipment.status)),
      rows: [
        ...visibleOrdersWithoutGuide.map((order) => ({
          orderNumber: order.orderNumber,
          provider: 'pending',
          guideSource: 'pending',
          trackingNumber: 'Pendiente',
          status: 'NO_GUIDE_RECORDED',
          recordType: 'DERIVED_ORDER_WITHOUT_GUIDE',
          createdAt: order.createdAt.toISOString(),
          href: `/admin/envios?search=${encodeURIComponent(order.orderNumber)}`,
        })),
        ...shipments.map((shipment) => ({
          orderNumber: shipment.order.orderNumber,
          provider: shipment.provider,
          guideSource: shipment.trackingNumber?.startsWith('MOCK99') ? 'MOCK_LOCAL' : shipment.provider,
          trackingNumber: shipment.trackingNumber ?? shipment.providerShipmentId ?? 'Pendiente',
          status: shipment.status,
          createdAt: shipment.createdAt.toISOString(),
          href: `/admin/envios?search=${encodeURIComponent(shipment.order.orderNumber)}`,
        })),
      ].slice(0, 80),
      empty: shipments.length === 0 && visibleOrdersWithoutGuide.length === 0,
    };
  }

  private buildNotificationsReport(
    statusRows: Array<{ status: string; _count: { status: number } }>,
    failedNotifications: FailedNotificationForReports[],
  ) {
    const counts = Object.fromEntries(statusRows.map((row) => [row.status, row._count.status]));
    return {
      kpis: {
        queuedNotifications: counts.queued ?? 0,
        sentNotifications: counts.sent ?? 0,
        failedNotifications: counts.failed ?? 0,
        providerStatus: 'BLOCKED_PROVIDER',
      },
      chart: Object.entries(counts).map(([label, value]) => ({ label, value })),
      rows: failedNotifications.map((notification) => ({
        eventName: notification.eventName,
        status: notification.status,
        provider: notification.provider,
        attempts: notification.attempts,
          lastError: this.safeErrorCode(notification.lastError),
        createdAt: notification.createdAt.toISOString(),
      })),
      empty: statusRows.length === 0,
    };
  }

  private buildAuditReport(audit: Array<{
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    actor: { email: string } | null;
  }>, allowed: boolean) {
    return {
      accessStatus: allowed ? 'GRANTED' : 'NO_PERMISSION',
      kpis: {
        auditEvents: allowed ? audit.length : 'NO_PERMISSION',
        reportsExports: allowed ? audit.filter((entry) => entry.action === 'reports.exported').length : 'NO_PERMISSION',
      },
      chart: this.countValues(audit.map((entry) => entry.action)),
      rows: audit.slice(0, 80).map((entry) => ({
        actor: entry.actor?.email ? this.maskEmail(entry.actor.email) : 'sistema',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        createdAt: entry.createdAt.toISOString(),
      })),
      empty: allowed && audit.length === 0,
    };
  }

  private buildReadiness() {
    const shippingProvider = process.env.SHIPPING_PROVIDER ?? 'internal';
    const appEnv = process.env.APP_ENV ?? 'local';
    const authDisabled = process.env.ADMIN_AUTH_DISABLED === 'true';
    const has99Credentials = Boolean(
      process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL &&
      process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD &&
      process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE,
    );
    const paymentsConfigured = process.env.PAYMENTS_REAL_PROVIDER_ENABLED === 'true';
    const emailConfigured = process.env.NOTIFICATIONS_REAL_PROVIDER_ENABLED === 'true' &&
      Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
    const stableDomain = Boolean(process.env.PUBLIC_APP_URL) &&
      !String(process.env.PUBLIC_APP_URL).includes('trycloudflare');

    const modules = [
      this.module('dashboard', 'Dashboard', 'READY', [], 'Operación ejecutiva.', 'Sin acción.', '/admin/dashboard'),
      this.module('reports', 'Reportes', 'READY', [], 'Análisis operativo.', 'Mantener filtros/export.', '/admin/reportes'),
      this.module('catalog', 'Catálogo', 'GO_WITH_RISKS', ['Precios avanzados parciales.'], 'Productos vendibles dependen de precio/stock.', 'Cerrar precios.', '/admin/productos'),
      this.module('inventory', 'Inventario', 'READY', [], 'Stock y kardex operativos.', 'Mantener conteos.', '/admin/inventario'),
      this.module('orders', 'Pedidos', 'READY', [], 'Ordenes operativas.', 'Cerrar fulfillment avanzado.', '/admin/pedidos'),
      this.module('payments', 'Pagos', 'BLOCKED_PROVIDER', [paymentsConfigured ? 'Configuración declarada; operación del proveedor no verificada.' : 'PSE/pagos reales pendientes.'], 'No hay pagos online reales.', 'Configurar provider real.', '/admin/pagos'),
      this.module('shipping', 'Envíos', has99Credentials && shippingProvider === '99envios' ? 'GO_WITH_RISKS' : shippingProvider === 'mock_99envios' ? 'MOCK_ONLY' : 'BLOCKED_PROVIDER', ['99 Envíos real/sandbox pendiente.'], 'Guías reales bloqueadas.', 'Probar credenciales 99 Envíos.', '/admin/envios'),
      this.module('notifications', 'Notificaciones', 'BLOCKED_PROVIDER', [emailConfigured ? 'Configuración declarada; operación de notificaciones no verificada.' : 'Email productivo pendiente.'], 'Correos reales bloqueados.', 'Configurar provider email.', '/admin/notificaciones'),
      this.module('settings', 'Configuración', appEnv === 'production' && !authDisabled && stableDomain ? 'GO_WITH_RISKS' : 'BLOCKED_CONFIGURATION', ['Producción bloqueada por entorno/dominio/providers.'], 'No se puede salir a producción.', 'Completar readiness.', '/admin/configuracion'),
      this.module('security', 'Seguridad', authDisabled && appEnv === 'production' ? 'NO_GO' : 'READY', authDisabled && appEnv === 'production' ? ['ADMIN_AUTH_DISABLED activo en producción.'] : [], 'Acceso admin protegido.', 'Mantener RBAC.', '/admin/roles'),
    ];
    const counts = modules.reduce<Record<string, number>>((acc, module) => {
      acc[module.status] = (acc[module.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      globalStatus: this.globalStatus(modules),
      counts,
      modules,
      chart: Object.entries(counts).map(([label, value]) => ({ label, value })),
    };
  }

  private module(
    key: string,
    label: string,
    status: ModuleStatus,
    blockers: string[],
    productionImpact: string,
    nextAction: string,
    href: string,
  ) {
    return { key, label, status, blockers, productionImpact, nextAction, href };
  }

  private globalStatus(modules: Array<{ status: ModuleStatus }>): ModuleStatus {
    if (modules.some((module) => module.status === 'NO_GO')) return 'NO_GO';
    if (modules.some((module) => module.status === 'BLOCKED_CONFIGURATION')) return 'BLOCKED_CONFIGURATION';
    if (modules.some((module) => module.status === 'BLOCKED_PROVIDER')) return 'BLOCKED_PROVIDER';
    if (modules.some((module) => module.status === 'MOCK_ONLY')) return 'MOCK_ONLY';
    if (modules.some((module) => module.status === 'GO_WITH_RISKS' || module.status === 'PARTIAL')) return 'GO_WITH_RISKS';
    return 'READY';
  }

  private exportRows(type: ReportType, report: Awaited<ReturnType<GetAdminReportsUseCase['execute']>>) {
    if (type === 'sales') return report.reports.sales.chart;
    if (type === 'orders') return report.reports.orders.rows;
    if (type === 'payments') return report.reports.payments.rows;
    if (type === 'inventory') return report.reports.inventory.rows;
    if (type === 'shipping') return report.reports.shipping.rows;
    if (type === 'notifications') return report.reports.notifications.rows;
    if (type === 'readiness') return report.reports.readiness.modules;
    if (type === 'audit') return report.reports.audit.rows;
    return Object.entries(report.summary).map(([metric, value]) => ({ metric, value }));
  }

  private reportType(value?: string): ReportType {
    const allowed: ReportType[] = ['summary', 'sales', 'orders', 'payments', 'inventory', 'shipping', 'notifications', 'readiness', 'audit'];
    if (value === undefined) return 'summary';
    if (!allowed.includes(value as ReportType)) throw new BadRequestException('Tipo de reporte no permitido.');
    return value as ReportType;
  }

  private toCsv(rows: Array<Record<string, unknown>>, metadata?: {
    title: string;
    range: string;
    actor: string;
    filters: Record<string, unknown>;
  }) {
    const generatedAt = new Date().toISOString();
    const normalized = rows.length ? rows : [{ empty: 'NO_DATA' }];
    const headers = Array.from(new Set(normalized.flatMap((row) => Object.keys(row))));
    const lines = [
      ...(metadata ? [
        `title,${csvCell(metadata.title)}`,
        `range,${csvCell(metadata.range)}`,
        `generatedAt,${csvCell(generatedAt)}`,
        `user,${csvCell(metadata.actor)}`,
        `filters,${csvCell(JSON.stringify(metadata.filters))}`,
      ] : []),
      headers.join(','),
      ...normalized.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
    ];
    return lines.join('\n');
  }

  private toPdf(input: {
    title: string;
    range: string;
    generatedAt: string;
    actor: string;
    filters: Record<string, unknown>;
    summary: Record<string, unknown>;
    rows: Array<Record<string, unknown>>;
  }) {
    const rows = input.rows.length ? input.rows.slice(0, 18) : [{ empty: 'NO_DATA' }];
    const lines = [
      input.title,
      `Rango: ${input.range}`,
      `Generado: ${input.generatedAt}`,
      `Usuario: ${input.actor}`,
      `Filtros: ${JSON.stringify(input.filters)}`,
      `Resumen: ${JSON.stringify(input.summary)}`,
      'Datos:',
      ...rows.map((row, index) => `${index + 1}. ${JSON.stringify(row)}`),
      'PII: redacted_by_default',
    ].map((line) => this.pdfSafe(this.safeText(line)).slice(0, 190));
    const content = [
      'BT',
      '/F1 9 Tf',
      '48 792 Td',
      ...lines.flatMap((line, index) => [
        index === 0 ? '' : '0 -16 Td',
        `(${line}) Tj`,
      ]).filter(Boolean),
      'ET',
    ].join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}\nendstream endobj`,
    ];
    let body = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(body, 'utf8'));
      body += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(body, 'utf8');
    body += `xref\n0 ${objects.length + 1}\n`;
    body += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
      body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(body, 'utf8');
  }

  private pdfSafe(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[()\\]/g, (char) => `\\${char}`)
      .replace(/[^\x20-\x7E]/g, ' ');
  }

  private salesByDay(orders: OrderForReports[]) {
    const grouped = new Map<string, { date: string; orders: number; amount: number }>();
    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      const current = grouped.get(date) ?? { date, orders: 0, amount: 0 };
      current.orders += 1;
      current.amount += Number(order.grandTotal);
      grouped.set(date, current);
    }
    return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
  }

  private countValues(values: string[]) {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }

  private resolveRange(range?: string) {
    const now = new Date();
    const from = new Date(now);
    let key: RangeKey = '30d';
    let label = 'Últimos 30 días';
    if (range === 'today') {
      key = 'today';
      label = 'Hoy';
      from.setHours(0, 0, 0, 0);
    } else if (range === '7d') {
      key = '7d';
      label = 'Últimos 7 días';
      from.setDate(from.getDate() - 7);
    } else if (range === 'month') {
      key = 'month';
      label = 'Mes actual';
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
    } else if (range === undefined || range === '30d') {
      from.setDate(from.getDate() - 30);
    } else {
      throw new BadRequestException('Rango de reporte no permitido.');
    }
    return { key, label, from: from.toISOString(), to: now.toISOString() };
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

  private safeText(value: string) {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/\b\d{7,}\b/g, '[numero]')
      .slice(0, 140);
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'usuario';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private safeErrorCode(value: string | null) {
    if (!value) return 'Sin detalle';
    return /^[A-Z][A-Z0-9_-]{0,79}$/.test(value) ? value : '[DETAILS_REDACTED]';
  }

  private validateQuery(query: ReportQuery & { type?: string; format?: string; includePii?: boolean }) {
    if (query.module !== undefined && typeof query.module !== 'string') {
      throw new BadRequestException('Entidad de auditoría no permitida.');
    }
    if (query.range !== undefined && !['today', '7d', '30d', 'month'].includes(query.range)) {
      throw new BadRequestException('Rango de reporte no permitido.');
    }
    if (query.status !== undefined && !Object.values(OrderStatus).includes(query.status as OrderStatus)) {
      throw new BadRequestException('Estado de pedido no permitido.');
    }
    if (query.paymentStatus !== undefined && !Object.values(PaymentStatus).includes(query.paymentStatus as PaymentStatus)) {
      throw new BadRequestException('Estado de pago no permitido.');
    }
    if (query.shippingStatus !== undefined && !Object.values(ShipmentStatus).includes(query.shippingStatus as ShipmentStatus)) {
      throw new BadRequestException('Estado de envío no permitido.');
    }
    for (const value of [query.module, query.status, query.paymentStatus, query.shippingStatus]) {
      if (value !== undefined && value.length > 80) throw new BadRequestException('Filtro excede el límite permitido.');
    }
    if (query.format !== undefined && !['csv', 'pdf'].includes(query.format)) {
      throw new BadRequestException('Formato de exportación no permitido.');
    }
    if (query.includePii !== undefined && typeof query.includePii !== 'boolean') {
      throw new BadRequestException('includePii debe ser booleano.');
    }
  }

}
