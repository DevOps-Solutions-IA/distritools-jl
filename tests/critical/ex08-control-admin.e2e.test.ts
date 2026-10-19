import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

describe('EX08 CONTROL persisted reporting contracts', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let admin: string; let viewer: string; let orderNumber: string;
  before(async () => {
    await resetDatabase(); seeded = await seedBaseData(); ({ app, http } = await createTestApp());
    admin = (await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret)).accessToken;
    viewer = (await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret)).accessToken;
    const order = await http.post('/api/v1/orders').send({ customer: { fullName: 'CONTROL synthetic buyer', email: 'control-fixture@example.test', phone: '3000000091' }, shipping: { address: 'Synthetic CONTROL address', city: 'Cali' }, items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }] });
    assert.equal(order.status, 201); orderNumber = order.body.order.orderNumber;
    await prisma.payment.create({ data: { id: uuidv7(), orderId: order.body.order.id, gateway: 'cash_on_delivery', gatewayReference: 'control-synthetic-cod', amount: '1000', currency: 'COP', status: 'pending' } });
  });
  after(async () => { await app.close(); await disconnectDatabase(); });
  await it('enforces auth and RBAC before reporting or export, without success audit', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'reports.exported' } });
    assert.equal((await http.get('/api/v1/admin/dashboard')).status, 401);
    assert.equal((await http.get('/api/v1/admin/reports/summary').set('Authorization', `Bearer ${viewer}`)).status, 403);
    assert.equal((await http.post('/api/v1/admin/reports/export').set('Authorization', `Bearer ${viewer}`).send({ type: 'orders', format: 'csv' })).status, 403);
    assert.equal(await prisma.auditLog.count({ where: { action: 'reports.exported' } }), before);
  });
  await it('returns authoritative window and stock snapshot with pending COD included once', async () => {
    const response = await http.get('/api/v1/admin/dashboard?range=today').set('Authorization', `Bearer ${admin}`);
    assert.equal(response.status, 200); assert.equal(response.body.range.key, 'today');
    assert(Date.parse(response.body.range.from) <= Date.parse(response.body.range.to));
    assert.equal(response.body.kpis.payments.pendingPayments, 1); assert.equal(response.body.kpis.payments.codPendingReconciliation, 1);
    assert(response.body.recentActivity.orders.some((row: { orderNumber: string }) => row.orderNumber === orderNumber));
  });
  await it('filters real orders and preserves filters in response rather than manufacturing an empty fallback', async () => {
    const response = await http.get('/api/v1/admin/reports/summary?range=30d&status=delivered&paymentStatus=approved').set('Authorization', `Bearer ${admin}`);
    assert.equal(response.status, 200); assert.equal(response.body.filters.status, 'delivered');
    assert.equal(response.body.reports.orders.rows.length, 0); assert.equal(response.body.reports.orders.empty, true);
    assert.equal(response.body.summary.orderCount, 0);
    assert.equal((await http.get('/api/v1/admin/reports/summary?range=90d').set('Authorization', `Bearer ${admin}`)).status, 400);
  });
  await it('exports CSV bytes safely and records exact actor/type/format filters durably', async () => {
    await prisma.product.update({ where: { id: seeded.inventory.productId }, data: { name: '=HYPERLINK("https://example.test")' } });
    const response = await http.post('/api/v1/admin/reports/export').set('Authorization', `Bearer ${admin}`).send({ type: 'inventory', range: '30d', format: 'csv' });
    assert.equal(response.status, 200); assert.match(response.headers['content-type'], /^text\/csv/);
    assert.match(response.headers['content-disposition'], /inventory\.csv/);
    assert(response.text.startsWith('title,')); assert(response.text.includes("'=HYPERLINK"));
    assert(!response.text.includes('control-fixture@example.test')); assert(!response.text.includes('Synthetic CONTROL address'));
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'reports.exported' }, orderBy: { createdAt: 'desc' } });
    assert.equal((audit.afterData as { type: string }).type, 'inventory');
    assert.equal((audit.afterData as { containsPii: boolean }).containsPii, false);
    assert.equal(audit.actorUserId, (await prisma.user.findUniqueOrThrow({ where: { email: seeded.users.adminEmail } })).id);
    assert(await prisma.auditLog.findUnique({ where: { id: audit.id } }));
  });
  await it('returns a real PDF signature and EOF with a persisted export audit', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'reports.exported' } });
    const response = await http.post('/api/v1/admin/reports/export').set('Authorization', `Bearer ${admin}`).send({ type: 'orders', range: '7d', format: 'pdf' });
    assert.equal(response.status, 200); assert.match(response.headers['content-type'], /^application\/pdf/);
    assert(Buffer.isBuffer(response.body)); assert(response.body.toString('utf8').startsWith('%PDF-1.4')); assert(response.body.toString('utf8').endsWith('%%EOF'));
    assert.equal(await prisma.auditLog.count({ where: { action: 'reports.exported' } }), before + 1);
  });
  await it('rejects PII export and unsupported format without success audit', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'reports.exported' } });
    assert.equal((await http.post('/api/v1/admin/reports/export').set('Authorization', `Bearer ${admin}`).send({ includePii: true })).status, 403);
    assert.equal((await http.post('/api/v1/admin/reports/export').set('Authorization', `Bearer ${admin}`).send({ format: 'html' })).status, 400);
    assert.equal(await prisma.auditLog.count({ where: { action: 'reports.exported' } }), before);
  });
});
