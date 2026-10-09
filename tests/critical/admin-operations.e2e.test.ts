import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

describe('Admin operations endpoints', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;
  let viewerToken: string;
  let orderId: string;
  let paymentId: string;

  before(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;

    const admin = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    const viewer = await loginAsAdmin(
      http,
      seeded.users.viewerEmail,
      seeded.users.viewerPassword,
      seeded.users.twoFactorSecret,
    );
    adminToken = admin.accessToken;
    viewerToken = viewer.accessToken;

    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Admin Ops Buyer',
        email: 'ops@example.com',
        phone: '3005555577',
      },
      shipping: {
        address: 'Calle 1',
        city: 'Cali',
      },
      items: [
        {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    assert.equal(order.status, 201);
    orderId = order.body.order.id;

    const codPayment = await prisma.payment.create({
      data: {
        id: uuidv7(),
        orderId,
        gateway: 'cash_on_delivery',
        gatewayReference: `cod-${order.body.order.orderNumber}`,
        amount: '1000.00',
        currency: 'COP',
        status: 'pending',
      },
    });
    paymentId = codPayment.id;
  });

  after(async () => {
    await app.close();
    await disconnectDatabase();
  });

  await it('protects admin list endpoints with auth and RBAC', async () => {
    const noAuth = await http.get('/api/v1/admin/orders');
    assert.equal(noAuth.status, 401);

    const forbidden = await http
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert.equal(forbidden.status, 403);
  });

  await it('lists real orders with masked customer PII and pagination', async () => {
    const response = await http
      .get('/api/v1/admin/orders?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.total >= 1, true);
    assert.equal(response.body.data[0].customerEmail.includes('***'), true);
    assert.equal(response.body.data[0].itemsCount >= 1, true);
    const invalidLimit = await http.get('/api/v1/admin/orders?limit=1e6')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(invalidLimit.status, 400);
  });

  await it('gates order address and notes behind sensitive-read permission and audits access', async () => {
    const orderRead = await prisma.permission.findUniqueOrThrow({ where: { slug: 'orders.read' } });
    await prisma.rolePermission.create({
      data: { id: uuidv7(), roleId: seeded.roles.limitedRoleId, permissionId: orderRead.id },
    });
    let viewer = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    let response = await http.get(`/api/v1/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.shipping.address, 'Dirección protegida');
    assert.equal(response.body.shipping.notes, '[PROTECTED]');
    assert.equal(response.body.customer.name.includes('Admin Ops'), false);

    const sensitiveRead = await prisma.permission.findUniqueOrThrow({ where: { slug: 'customers.read_sensitive' } });
    await prisma.rolePermission.create({
      data: { id: uuidv7(), roleId: seeded.roles.limitedRoleId, permissionId: sensitiveRead.id },
    });
    viewer = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    response = await http.get(`/api/v1/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    assert.equal(response.body.shipping.address, 'Calle 1');
    assert.equal(response.body.customer.name, 'Admin Ops Buyer');
    assert.equal(response.body.totals.grandTotal, 'NO_PERMISSION');
    assert.equal(await prisma.auditLog.count({ where: { action: 'order.view_sensitive', entityId: orderId } }) >= 1, true);
  });

  await it('scopes payment webhook events to the payment reference', async () => {
    const otherPayment = await prisma.payment.create({
      data: {
        id: uuidv7(), orderId, gateway: 'cash_on_delivery', gatewayReference: 'different-payment-reference',
        amount: '1000.00', currency: 'COP', status: 'pending',
      },
    });
    const matchingEventId = uuidv7();
    const unrelatedEventId = uuidv7();
    await prisma.webhookReceipt.createMany({
      data: [
        {
          id: matchingEventId, gateway: 'cash_on_delivery', externalEventId: `event-${matchingEventId}`,
          payload: { gatewayReference: (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).gatewayReference, privatePayload: 'must-not-return' },
        },
        {
          id: unrelatedEventId, gateway: 'cash_on_delivery', externalEventId: `event-${unrelatedEventId}`,
          payload: { gatewayReference: otherPayment.gatewayReference, privatePayload: 'must-not-return' },
        },
      ],
    });
    const response = await http.get(`/api/v1/admin/payments/${paymentId}/events`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.some((event: { id: string }) => event.id === matchingEventId), true);
    assert.equal(response.body.data.some((event: { id: string }) => event.id === unrelatedEventId), false);
    assert.equal(JSON.stringify(response.body).includes('must-not-return'), false);
    assert.equal(JSON.stringify(response.body).includes('different-payment-reference'), false);
  });

  await it('blocks invalid order transitions and audits valid internal notes', async () => {
    const invalid = await http
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shipped' });
    assert.equal(invalid.status, 400);

    const note = await http
      .post(`/api/v1/admin/orders/${orderId}/internal-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Verificar disponibilidad antes de despacho.' });
    assert.equal(note.status, 201);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'order.internal_note_added', entityId: orderId },
    });
    assert.equal(Boolean(audit), true);
  });

  await it('lists payments and reconciles COD without faking PSE', async () => {
    const list = await http
      .get('/api/v1/admin/payments')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.some((payment: { id: string }) => payment.id === paymentId), true);

    const refresh = await http
      .post(`/api/v1/admin/payments/${paymentId}/refresh-status`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(refresh.status, 201);
    assert.equal(refresh.body.refreshed, false);

    const reconcile = await http
      .post(`/api/v1/admin/payments/${paymentId}/reconcile-cod`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reference: 'recibo-cod-1' });
    assert.equal(reconcile.status, 201);
    assert.equal(reconcile.body.status, 'approved');
  });

  await it('persists quote workflow without inventing prices or sent notifications', async () => {
    const created = await http
      .post('/api/v1/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: {
          fullName: 'Quote Buyer',
          email: 'quote@example.com',
          phone: '3001234567',
          city: 'Cali',
          dataTreatmentConsent: true,
        },
        items: [
          {
            productId: seeded.inventory.productId,
            variantId: seeded.inventory.variantId,
            nameSnapshot: 'Taladro por cotizar',
            skuSnapshot: 'TOTAL-001',
            quantity: 2,
          },
        ],
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'requested');
    assert.equal(created.body.customer.email.includes('***'), true);

    const priced = await http
      .post(`/api/v1/admin/quotes/${created.body.id}/price-items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ id: created.body.items[0].id, quantity: 2, unitPrice: '150000' }],
      });
    assert.equal(priced.status, 201);
    assert.equal(priced.body.status, 'quoted');
    assert.equal(priced.body.subtotal, '300000.00');

    const send = await http
      .post(`/api/v1/admin/quotes/${created.body.id}/send`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(send.status, 201);
    assert.equal(send.body.operationalState.status, 'pending_manual_send');

    const converted = await http
      .post(`/api/v1/admin/quotes/${created.body.id}/convert-to-order`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(converted.status, 201);
    assert.equal(converted.body.status, 'converted_to_order');

    const event = await prisma.notificationEvent.findFirst({
      where: { entityType: 'quote', entityId: created.body.id },
    });
    assert.equal(event?.status, 'skipped_provider_not_configured');
  });

  await it('persists shipment rows and fails closed without fake guide or tracking', async () => {
    const quoted = await http
      .post(`/api/v1/admin/shipments/${orderId}/quote`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ packageSnapshot: { source: 'critical-test' } });
    assert.equal(quoted.status, 201);
    assert.equal(quoted.body.provider, 'none');
    assert.equal(quoted.body.trackingNumber, null);
    assert.equal(quoted.body.routeNumber, null);
    assert.equal(quoted.body.operationalState.status, 'provider_not_configured');
    assert.equal('addressSnapshot' in quoted.body, false);
    assert.equal('packageSnapshot' in quoted.body, false);
    assert.equal('labelUrl' in quoted.body, false);

    const create = await http
      .post(`/api/v1/admin/shipments/${orderId}/create`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ packageSnapshot: { source: 'critical-test' } });
    assert.equal(create.status, 201);
    assert.equal(create.body.created, false);

    const events = await http
      .get(`/api/v1/admin/shipments/${quoted.body.id}/events`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(events.status, 200);
    assert.equal(events.body.data.length >= 1, true);
  });

  await it('lists customers masked, users, roles, and audit data', async () => {
    const customersBefore = await prisma.customer.count();
    const customers = await http
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(customers.status, 200);
    assert.equal(customers.body.data[0].email.includes('***'), true);
    assert.equal(await prisma.customer.count(), customersBefore);

    const customerOrders = await http
      .get(`/api/v1/admin/customers/${customers.body.data[0].id}/orders?limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(customerOrders.status, 200);
    assert.equal(customerOrders.body.meta.limit, 1);

    const sensitive = await http
      .post(`/api/v1/admin/customers/${customers.body.data[0].id}/view-sensitive`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(sensitive.status, 201);
    assert.equal(sensitive.body.email.includes('***'), false);

    const users = await http
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(users.status, 200);
    assert.equal(users.body.data[0].email.includes('***'), true);

    const roles = await http
      .get('/api/v1/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(roles.status, 200);
    assert.equal(roles.body.data[0].permissions.length > 0, true);

    const audit = await http
      .get('/api/v1/admin/audit?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(audit.status, 200);
    assert.equal(Array.isArray(audit.body.data), true);
  });

  await it('masks settings secrets and enforces legal/footer workflows', async () => {
    const settings = await http
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payments: { publicLabel: 'PSE pendiente', privateKey: 'no-se-expone' } });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.settings.payments.privateKey, '[REDACTED]');

    const settingsRead = await http
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(settingsRead.status, 200);
    assert.equal(
      settingsRead.body.persisted.some((row: { key: string; isSecret: boolean; value: { configured?: boolean } }) =>
        row.key === 'payments.privateKey' && row.isSecret && row.value.configured === true,
      ),
      true,
    );

    const legal = await http
      .post('/api/v1/admin/content/legal')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pageKey: 'critical-test-legal',
        title: 'Legal crítico',
        slug: 'legal-critico',
        content: { sections: [{ title: 'Estado', body: '[RAZÓN SOCIAL PENDIENTE]' }] },
        checklist: {},
      });
    assert.equal(legal.status, 201);

    const prematurePublish = await http
      .post(`/api/v1/admin/content/legal/${legal.body.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(prematurePublish.status, 400);

    const review = await http
      .post(`/api/v1/admin/content/legal/${legal.body.id}/submit-review`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(review.status, 201);
    const approved = await http
      .post(`/api/v1/admin/content/legal/${legal.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(approved.status, 201);
    const overridePublish = await http
      .post(`/api/v1/admin/content/legal/${legal.body.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ legalOverride: true });
    assert.equal(overridePublish.status, 201);
    assert.equal(overridePublish.body.status, 'published');

    const footer = await http
      .post('/api/v1/admin/content/footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groups: [
          {
            title: 'Legal',
            links: [{ label: 'Privacidad', href: '/politica-de-privacidad' }],
          },
        ],
      });
    assert.equal(footer.status, 201);
    const badFooter = await http
      .post('/api/v1/admin/content/footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ groups: [{ title: 'Roto', links: [{ label: 'Roto', href: '#' }] }] });
    assert.equal(badFooter.status, 400);
  });

  await it('updates prices with audit and rejects negative prices', async () => {
    const negative = await http
      .post('/api/v1/admin/prices/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ variantId: seeded.inventory.variantId, price: '-1' });
    assert.equal(negative.status, 400);

    const update = await http
      .post('/api/v1/admin/prices/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ variantId: seeded.inventory.variantId, price: '299900', reason: 'Ajuste admin' });
    assert.equal(update.status, 201);
    assert.equal(update.body.price, '299900.00');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'variant.price_updated', entityId: seeded.inventory.variantId },
    });
    assert.equal(Boolean(audit), true);
  });
});
