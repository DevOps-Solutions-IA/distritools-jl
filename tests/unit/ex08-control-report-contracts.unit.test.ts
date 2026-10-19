import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetAdminReportsUseCase } from 'src/modules/analytics/application/use-cases/get-admin-reports.use-case';
import { GetAdminDashboardUseCase } from 'src/modules/analytics/application/use-cases/get-admin-dashboard.use-case';

const actor = { sub: 'control-operator', email: 'operator@example.test', role: 'viewer', permissions: ['reports.read', 'dashboard.read', 'reports.financial.read'] } as CurrentUser;
const now = new Date();
const payment = (status: string) => ({ status, gateway: 'cash_on_delivery', amount: new Prisma.Decimal(100), createdAt: now });
const order = (payments: ReturnType<typeof payment>[] = []) => ({ id: 'order-1', orderNumber: 'CONTROL-1', status: 'paid', grandTotal: new Prisma.Decimal(100), createdAt: now, orderItems: [], payments, shipments: [] });

/** The database boundary stays external; execute/buildExport and all shaping logic are real. */
function fixture(orders: ReturnType<typeof order>[] = [], products: unknown[] = [], shipments: unknown[] = []) {
  let shipmentQuery: unknown;
  let transactions = 0;
  const empty = { count: async () => 0, findMany: async () => [], groupBy: async () => [] };
  const tx = {
    order: { ...empty, findMany: async () => orders }, product: { ...empty, findMany: async () => products },
    shipment: { ...empty, findMany: async (query: unknown) => { shipmentQuery = query; return shipments; } },
    orderItem: empty, payment: empty, variant: empty, inventoryItem: empty, customer: empty, notification: empty, auditLog: empty,
  };
  const db = { $transaction: async (work: (client: typeof tx) => unknown) => { transactions++; return work(tx); } } as unknown as PrismaService;
  return { reports: new GetAdminReportsUseCase(db), dashboard: new GetAdminDashboardUseCase(db), shipmentQuery: () => shipmentQuery, transactions: () => transactions };
}

describe('CONTROL truthful reporting boundaries', () => {
  for (const module of [null, ['order', 'product'], {}, 42, false, 'x'.repeat(81)]) {
    it(`invalid module ${JSON.stringify(module)} is rejected as 400 before summary/export persistence`, async () => {
      const f = fixture();
      const query = { module } as unknown as { module: string };
      const badRequest = (error: unknown) => Boolean(error && typeof error === 'object' && 'getStatus' in error && (error as { getStatus(): number }).getStatus() === 400);
      await assert.rejects(f.reports.execute(actor, query), badRequest);
      await assert.rejects(f.reports.buildExport({ ...actor, permissions: [...actor.permissions, 'reports.export'] }, query), badRequest);
      assert.equal(f.transactions(), 0);
    });
  }
  it('accepts a module at the existing eighty-character boundary', async () => {
    const f = fixture();
    assert.equal((await f.reports.execute(actor, { module: 'x'.repeat(80) })).filters.module, 'x'.repeat(80));
  });
  it('pending COD is counted once in the persisted dashboard alert', async () => {
    const f = fixture([order([payment('pending')])]);
    const data = await f.dashboard.execute(actor);
    const alert = data.alerts.find(row => row.actionLabel === 'Ver pagos');
    assert.equal(alert?.message, '1 pagos pendientes por conciliar.');
  });
  it('payment status constrains payment rows, chart and KPI after parent-order matching', async () => {
    const f = fixture([order([payment('approved'), payment('pending')])]);
    const data = await f.reports.execute(actor, { paymentStatus: 'pending' });
    assert.deepEqual(data.reports.payments.rows.map(row => row.status), ['pending']);
    assert.deepEqual(data.reports.payments.chart, [{ label: 'pending', value: 1 }]);
    assert.equal(data.reports.payments.kpis.approvedPayments, 0);
    assert.equal(data.reports.payments.kpis.pendingPayments, 1);
    // The order column is the latest persisted relation; the filter matches a related record.
    assert.equal(data.reports.orders.rows[0].paymentStatus, 'approved');
  });
  it('shipment status and associated order filters reach the bounded database query', async () => {
    const f = fixture();
    await f.reports.execute(actor, { status: 'paid', paymentStatus: 'approved', shippingStatus: 'delivered' });
    const where = (f.shipmentQuery() as { where: Record<string, unknown> }).where;
    assert.equal(where.status, 'delivered');
    assert.deepEqual(where.order, { status: 'paid', payments: { some: { status: 'approved' } } });
    const dates = where.createdAt as { gte: Date; lte: Date };
    assert(dates.gte instanceof Date && dates.lte instanceof Date && dates.gte <= dates.lte);
  });
  it('an actual shipment-state filter excludes derived orders-without-guide rows', async () => {
    const source = order();
    Object.assign(source, { shipments: [{ status: 'delivered', trackingNumber: null, providerShipmentId: null }] });
    const f = fixture([source], [], [{ id: 'shipment-1', status: 'delivered', provider: 'internal', trackingNumber: null, providerShipmentId: null, createdAt: now, order: { orderNumber: 'CONTROL-1' } }]);
    const data = await f.reports.execute(actor, { shippingStatus: 'delivered' });
    assert.deepEqual(data.reports.shipping.rows.map(row => row.status), ['delivered']);
    assert.deepEqual(data.reports.shipping.chart, [{ label: 'delivered', value: 1 }]);
  });
  it('an order without persisted payment or shipment has explicit absent data', async () => {
    const f = fixture([order()]);
    const reports = await f.reports.execute(actor);
    assert.equal(reports.reports.orders.rows[0].paymentStatus, 'NO_DATA');
    assert.equal(reports.reports.orders.rows[0].shippingStatus, 'NO_DATA');
    const dashboard = await f.dashboard.execute(actor);
    assert.equal(dashboard.recentActivity.orders[0].paymentStatus, 'NO_DATA');
    assert.equal(dashboard.recentActivity.orders[0].shippingStatus, 'NO_DATA');
  });
  it('a zero-variant product is a visible incomplete product without an invented variant', async () => {
    const f = fixture([], [{ name: 'Producto sin variantes', isActive: true, brand: null, category: null, variants: [] }]);
    const result = await f.reports.execute(actor);
    assert.equal(result.reports.inventory.rows.length, 1);
    assert.equal(result.reports.inventory.rows[0].product, 'Producto sin variantes');
    assert(result.reports.inventory.rows[0].reasons.includes('Sin variantes'));
    assert.equal(result.reports.inventory.kpis.variants, 0);
    assert.equal(result.reports.inventory.kpis.nonSellableProducts, 1);
  });
  it('a payment feature flag is not operational provider certification', async () => {
    const prior = process.env.PAYMENTS_REAL_PROVIDER_ENABLED;
    process.env.PAYMENTS_REAL_PROVIDER_ENABLED = 'true';
    try {
      const f = fixture(); const reports = await f.reports.execute(actor); const dashboard = await f.dashboard.execute(actor);
      assert.equal(reports.reports.payments.kpis.providerStatus, 'BLOCKED_PROVIDER');
      assert.equal(reports.reports.readiness.modules.find(row => row.key === 'payments')?.status, 'BLOCKED_PROVIDER');
      assert.equal(dashboard.kpis.payments.paymentProviderStatus, 'BLOCKED_PROVIDER');
      assert.equal(dashboard.readiness.modules.find(row => row.key === 'payments')?.status, 'BLOCKED_PROVIDER');
    } finally { if (prior === undefined) delete process.env.PAYMENTS_REAL_PROVIDER_ENABLED; else process.env.PAYMENTS_REAL_PROVIDER_ENABLED = prior; }
  });
  it('notification flags and SMTP configuration are not operational provider certification', async () => {
    const priorFlag = process.env.NOTIFICATIONS_REAL_PROVIDER_ENABLED;
    const priorHost = process.env.SMTP_HOST;
    process.env.NOTIFICATIONS_REAL_PROVIDER_ENABLED = 'true';
    process.env.SMTP_HOST = 'synthetic-smtp.invalid';
    try {
      const f = fixture(); const reports = await f.reports.execute(actor); const dashboard = await f.dashboard.execute(actor);
      assert.equal(reports.reports.notifications.kpis.providerStatus, 'BLOCKED_PROVIDER');
      assert.equal(reports.reports.readiness.modules.find(row => row.key === 'notifications')?.status, 'BLOCKED_PROVIDER');
      assert.equal(dashboard.readiness.modules.find(row => row.key === 'notifications')?.status, 'BLOCKED_PROVIDER');
    } finally {
      if (priorFlag === undefined) delete process.env.NOTIFICATIONS_REAL_PROVIDER_ENABLED; else process.env.NOTIFICATIONS_REAL_PROVIDER_ENABLED = priorFlag;
      if (priorHost === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = priorHost;
    }
  });
});
