import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

// Execute only after the orchestrator provisions owned disposable PostgreSQL/Redis.
// No mocks, provider calls or production RBAC changes: grants below are test fixtures.
describe('EX-07.4 A4 CRM permission, PII and bounded-read contracts', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'] | undefined;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;
  let viewerToken: string;
  let customerId: string;
  let orderIds: string[];
  let quoteIds: string[];
  const pii = {
    fullName: 'Cliente Sintetico A4', email: 'crm-a4@example.invalid', phone: '00000007404',
    defaultAddress: 'Domicilio ficticio A4', documentNumber: 'DOC-FICTICIO-A4',
  };
  const guestEmail = 'guest-a4@example.invalid';

  before(async () => {
    // This check precedes resetDatabase, seed and application initialization.
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
      validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] };
    };
    assert.equal(process.env.APP_ENV, 'test');
    const isolation = validateTestEnvironment(process.env);
    assert.equal(isolation.ok, true, isolation.failures.join('; '));
    await resetDatabase();
    seeded = await seedBaseData();
    ({ app, http } = await createTestApp());
    const admin = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    const viewer = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    assert.ok(admin.accessToken);
    assert.ok(viewer.accessToken);
    adminToken = admin.accessToken;
    viewerToken = viewer.accessToken;

    customerId = uuidv7();
    await prisma.customer.create({ data: { id: customerId, ...pii, lastOrderAt: new Date('2026-01-03T00:00:00Z') } });
    await prisma.customer.create({ data: {
      id: uuidv7(), fullName: 'Segundo Sintetico A4', email: 'second-a4@example.invalid',
      lastOrderAt: new Date('2026-01-02T00:00:00Z'),
    } });
    orderIds = Array.from({ length: 51 }, () => uuidv7());
    await prisma.order.createMany({ data: [...orderIds, uuidv7()].map((id, index) => ({
      id, orderNumber: `A4-ORDER-${index}`, status: 'draft' as const, customerId: index < 51 ? customerId : null,
      customerName: pii.fullName, customerEmail: index < 51 ? pii.email : guestEmail,
      customerPhone: pii.phone, shippingAddress: pii.defaultAddress, shippingCity: 'Ciudad ficticia',
      subtotal: '10', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '10',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    })) });
    await prisma.customerConsent.createMany({ data: Array.from({ length: 101 }, (_, index) => ({
      id: uuidv7(), customerId, type: 'data_treatment' as const, accepted: false, source: 'a4-synthetic-fixture',
      ipHash: 'A4-HASH-NO-RETURN', userAgentHash: 'A4-AGENT-NO-RETURN',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    })) });
    quoteIds = [];
    for (let index = 0; index < 3; index += 1) {
      const id = uuidv7();
      quoteIds.push(id);
      await prisma.quote.create({ data: {
        id, quoteNumber: `A4-QUOTE-${index}`, customerId, orderId: orderIds[index], subtotal: '10',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        items: { create: {
          id: uuidv7(), productId: seeded.inventory.productId, variantId: seeded.inventory.variantId,
          nameSnapshot: 'Producto fixture A4', quantity: 1, unitPrice: '10', totalPrice: '10',
        } },
      } });
    }
  });

  after(async () => {
    if (app) await app.close();
    await disconnectDatabase();
  });

  async function businessSnapshot() {
    return {
      customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }),
      orders: await prisma.order.findMany({ orderBy: { id: 'asc' } }),
      quotes: await prisma.quote.findMany({ orderBy: { id: 'asc' } }),
      items: await prisma.quoteItem.findMany({ orderBy: { id: 'asc' } }),
      consents: await prisma.customerConsent.findMany({ orderBy: { id: 'asc' } }),
    };
  }

  async function grantCustomerRead() {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: 'customers.read' } });
    await prisma.rolePermission.createMany({
      data: [{ id: uuidv7(), roleId: seeded.roles.limitedRoleId, permissionId: permission.id }],
      skipDuplicates: true,
    });
    const reader = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    for (const slug of ['customers.read_sensitive', 'customers.notes.write', 'customers.export', 'reports.financial.read']) {
      assert.equal(reader.user.permissions.includes(slug), false, slug);
    }
    assert.equal(reader.user.permissions.includes('customers.read'), true);
    return reader.accessToken;
  }

  function assertMaskedCustomer(body: { id: string; fullName: string; email: string; phone: string }) {
    assert.equal(body.id, customerId);
    for (const field of ['fullName', 'email', 'phone'] as const) {
      assert.notEqual(body[field], pii[field], field);
      assert.ok(body[field].includes('***'), field);
    }
    assert.equal(Object.hasOwn(body, 'defaultAddress'), false);
    assert.equal(Object.hasOwn(body, 'documentNumber'), false);
  }

  function assertNoRawPii(body: unknown) {
    const serialized = JSON.stringify(body);
    for (const value of [...Object.values(pii), 'A4-HASH-NO-RETURN', 'A4-AGENT-NO-RETURN']) {
      assert.equal(serialized.includes(value), false, `Raw fixture value returned: ${value}`);
    }
  }

  it('P1: requires 401/403 for customer reads and permits the existing admin actor without business writes', async () => {
    const snapshot = await businessSnapshot();
    for (const route of ['/api/v1/admin/customers', `/api/v1/admin/customers/${customerId}`,
      `/api/v1/admin/customers/${customerId}/orders`, `/api/v1/admin/customers/${customerId}/quotes`]) {
      assert.equal((await http.get(route)).status, 401, route);
      assert.equal((await http.get(route).set('Authorization', `Bearer ${viewerToken}`)).status, 403, route);
      assert.equal((await http.get(route).set('Authorization', `Bearer ${adminToken}`)).status, 200, route);
    }
    assert.deepEqual(await businessSnapshot(), snapshot);
    assert.equal(await prisma.customer.count({ where: { email: guestEmail } }), 0);
  });

  it('P1: customers.read masks nested PII and financial fields; profile, relations and list stay read-only', async () => {
    const readerToken = await grantCustomerRead();
    const snapshot = await businessSnapshot();
    const base = `/api/v1/admin/customers/${customerId}`;
    const profile = await http.get(base).set('Authorization', `Bearer ${readerToken}`);
    assert.equal(profile.status, 200);
    assertMaskedCustomer(profile.body);
    assert.equal(profile.body.orders.length, 50);
    assert.equal(profile.body.consents.length, 100);
    for (const order of profile.body.orders) assert.equal(order.grandTotal, 'NO_PERMISSION');
    assertNoRawPii(profile.body);
    const quotes = await http.get(`${base}/quotes`).set('Authorization', `Bearer ${readerToken}`);
    assert.equal(quotes.status, 200);
    assert.equal(quotes.body.data.length, 3);
    assertMaskedCustomer(quotes.body.customer);
    for (const quote of quotes.body.data) {
      assertMaskedCustomer(quote.customer);
      assert.equal(quote.subtotal, 'NO_PERMISSION');
      assert.equal(quote.items.length, 1);
      assert.equal(quote.items[0].unitPrice, 'NO_PERMISSION');
      assert.equal(quote.items[0].totalPrice, 'NO_PERMISSION');
      assert.deepEqual(Object.keys(quote.order).sort(), ['id', 'orderNumber', 'status']);
    }
    assertNoRawPii(quotes.body);
    const list = await http.get('/api/v1/admin/customers').set('Authorization', `Bearer ${readerToken}`);
    assert.equal(list.status, 200);
    const listed = list.body.data.find((row: { id: string }) => row.id === customerId);
    assert.ok(listed);
    assertMaskedCustomer(listed);
    assert.equal(listed.ordersCount, 51);
    assert.equal(listed.totalSpent, 'NO_PERMISSION');
    assertNoRawPii(list.body);
    const orders = await http.get(`${base}/orders`).set('Authorization', `Bearer ${readerToken}`);
    assert.equal(orders.status, 200);
    assert.equal(orders.body.data.length, 20);
    for (const order of orders.body.data) assert.equal(order.grandTotal, 'NO_PERMISSION');
    assertNoRawPii(orders.body);
    assert.deepEqual(await businessSnapshot(), snapshot);
    assert.equal(await prisma.customer.count({ where: { email: guestEmail } }), 0);
  });

  it('P1: profile modification requires customers.notes.write and persists a sanitized customer.updated audit', async () => {
    const route = `/api/v1/admin/customers/${customerId}`;
    const snapshot = await businessSnapshot();
    const auditWhere = { action: 'customer.updated', entityType: 'customer', entityId: customerId };
    const auditsBefore = await prisma.auditLog.count({ where: auditWhere });
    const payload = { fullName: 'Cliente Modificado Ficticio A4', phone: '00000007499' };
    assert.equal((await http.patch(route).send(payload)).status, 401);
    assert.equal((await http.patch(route).set('Authorization', `Bearer ${viewerToken}`).send(payload)).status, 403);
    assert.deepEqual(await businessSnapshot(), snapshot);
    assert.equal(await prisma.auditLog.count({ where: auditWhere }), auditsBefore);
    const response = await http.patch(route).set('Authorization', `Bearer ${adminToken}`).send(payload);
    assert.equal(response.status, 200);
    const persisted = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(persisted.fullName, payload.fullName);
    assert.equal(persisted.phone, payload.phone);
    assert.equal(response.body.fullName.includes('***'), true);
    assert.equal(response.body.phone.includes('***'), true);
    assert.equal(await prisma.auditLog.count({ where: auditWhere }), auditsBefore + 1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: auditWhere, orderBy: { createdAt: 'desc' } });
    assert.equal(audit.actorUserId, seeded.users.adminUserId);
    for (const data of [audit.beforeData, audit.afterData]) {
      const redacted = data as { fullName: string; email: string; phone: string };
      assert.equal(redacted.fullName, '[REDACTED]');
      assert.equal(redacted.email, '[REDACTED]');
      assert.equal(redacted.phone, '[REDACTED]');
      assertNoRawPii(data);
      assert.equal(JSON.stringify(data).includes(payload.fullName), false);
      assert.equal(JSON.stringify(data).includes(payload.phone), false);
    }
  });

  it('P2: list and relations reject malformed/out-of-range pagination and return disjoint bounded pages', async () => {
    const readerToken = await grantCustomerRead();
    const snapshot = await businessSnapshot();
    const routes = ['/api/v1/admin/customers', `/api/v1/admin/customers/${customerId}/orders`,
      `/api/v1/admin/customers/${customerId}/quotes`];
    const expected = [[customerId], [orderIds[50]], [quoteIds[2]]];
    for (const [index, route] of routes.entries()) {
      for (const query of ['limit=0', 'limit=-1', 'limit=1.5', 'limit=1e2', 'limit=101', 'limit=9007199254740992',
        'page=0', 'page=10001', 'page=1e2']) {
        assert.equal((await http.get(`${route}?${query}`).set('Authorization', `Bearer ${readerToken}`)).status, 400, `${route}?${query}`);
      }
      const first = await http.get(`${route}?limit=1&page=1`).set('Authorization', `Bearer ${readerToken}`);
      const second = await http.get(`${route}?limit=1&page=2`).set('Authorization', `Bearer ${readerToken}`);
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.deepEqual(first.body.meta, { page: 1, limit: 1, total: [2, 51, 3][index] });
      assert.deepEqual(second.body.meta, { page: 2, limit: 1, total: [2, 51, 3][index] });
      assert.deepEqual(first.body.data.map((row: { id: string }) => row.id), expected[index]);
      assert.equal(second.body.data.length, 1);
      assert.notEqual(first.body.data[0].id, second.body.data[0].id);
      const upper = await http.get(`${route}?limit=100&page=10000`).set('Authorization', `Bearer ${readerToken}`);
      assert.equal(upper.status, 200);
      assert.equal(upper.body.meta.limit, 100);
      assert.deepEqual(upper.body.data, []);
    }
    assert.deepEqual(await businessSnapshot(), snapshot);
  });

  it('P1: sensitive reveal is permission-gated and audited; even authorized customer export remains blocked', async () => {
    const snapshot = await businessSnapshot();
    const sensitiveRoute = `/api/v1/admin/customers/${customerId}/view-sensitive`;
    const exportRoute = '/api/v1/admin/customers/export';
    const sensitiveWhere = { action: 'customer.view_sensitive', entityType: 'customer', entityId: customerId };
    const exportWhere = { action: 'customer.export_blocked', entityType: 'customer', entityId: 'export' };
    const sensitiveBefore = await prisma.auditLog.count({ where: sensitiveWhere });
    const exportBefore = await prisma.auditLog.count({ where: exportWhere });
    for (const route of [sensitiveRoute, exportRoute]) {
      assert.equal((await http.post(route)).status, 401);
      assert.equal((await http.post(route).set('Authorization', `Bearer ${viewerToken}`)).status, 403);
    }
    assert.deepEqual(await businessSnapshot(), snapshot);
    assert.equal(await prisma.auditLog.count({ where: sensitiveWhere }), sensitiveBefore);
    assert.equal(await prisma.auditLog.count({ where: exportWhere }), exportBefore);
    const sensitive = await http.post(sensitiveRoute).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(sensitive.status, 201);
    assert.equal(sensitive.body.email, pii.email);
    assert.equal(sensitive.body.defaultAddress, pii.defaultAddress);
    assert.equal(sensitive.body.documentNumber, '[PROTECTED]');
    assert.equal(await prisma.auditLog.count({ where: sensitiveWhere }), sensitiveBefore + 1);
    const sensitiveAudit = await prisma.auditLog.findFirstOrThrow({ where: sensitiveWhere });
    assert.equal(sensitiveAudit.actorUserId, seeded.users.adminUserId);
    assertNoRawPii(sensitiveAudit.afterData);
    const exported = await http.post(exportRoute).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(exported.status, 201);
    assert.equal(exported.body.exported, false);
    assert.equal(exported.body.operationalState.status, 'blocked');
    assert.deepEqual(Object.keys(exported.body).sort(), ['exported', 'operationalState']);
    assertNoRawPii(exported.body);
    assert.equal(await prisma.auditLog.count({ where: exportWhere }), exportBefore + 1);
    const exportAudit = await prisma.auditLog.findFirstOrThrow({ where: exportWhere });
    assert.equal(exportAudit.actorUserId, seeded.users.adminUserId);
    assert.deepEqual(exportAudit.afterData, { exported: false });
    assert.deepEqual(await businessSnapshot(), snapshot);
  });
});
