import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

function signWebhook(gateway: string, payload: string): string {
  return createHmac('sha256', process.env.PAYMENT_GATEWAY_SECRET!)
    .update(`${gateway}.${payload}`)
    .digest('hex');
}

async function waitFor<T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 5000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await fetcher();
    if (predicate(value)) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timeout waiting for condition');
}

describe('Platform closure modules', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;

  before(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
  });

  beforeEach(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const admin = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    adminToken = admin.accessToken;
  });

  after(async () => {
    await app.close();
    await disconnectDatabase();
  });

  await it('audita flujos críticos y expone lectura segura del trail', async () => {
    const requestId = 'req-audit-001';
    const correlationId = 'corr-audit-001';
    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Audit Buyer',
        email: 'audit@example.com',
        phone: '3007000000',
      },
      shipping: {
        address: 'Audit street',
        city: 'Bogota',
      },
      items: [
        {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    }).set('x-request-id', requestId)
      .set('x-correlation-id', correlationId);
    assert.equal(order.status, 201);

    const auditLogs = await http
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ entityType: 'order', entityId: order.body.order.id });

    assert.equal(auditLogs.status, 200);
    const createdLog = auditLogs.body.data.find(
      (entry: { action: string }) => entry.action === 'order.created',
    );
    assert.ok(createdLog);
    assert.equal(createdLog.requestId, requestId);
    assert.equal(createdLog.correlationId, correlationId);
  });

  await it('redacta payloads sensibles de webhook en auditoría', async () => {
    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Audit Webhook Buyer',
        email: 'audit-webhook@example.com',
        phone: '3007999999',
      },
      shipping: {
        address: 'Webhook street',
        city: 'Bogota',
      },
      items: [
        {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    assert.equal(order.status, 201);

    const paymentIntent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    assert.equal(paymentIntent.status, 201);

    const payload = JSON.stringify({
      eventId: 'evt-audit-redaction-1',
      gatewayReference: paymentIntent.body.payment.gatewayReference,
      transactionId: 'txn-audit-redaction-1',
      status: 'approved',
      secretProbe: 'must-not-leak',
    });

    const webhook = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    assert.equal(webhook.status, 201);

    const logs = await http
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'payment.webhook_processed' });

    assert.equal(logs.status, 200);
    const webhookLog = logs.body.data.find(
      (entry: { entityId: string }) => entry.entityId === paymentIntent.body.payment.id,
    );
    assert.ok(webhookLog);
    assert.equal(
      webhookLog.afterData.payment.rawPayload,
      '[REDACTED]',
    );
  });

  await it('procesa notificaciones por eventos, guarda historial y maneja fallos', async () => {
    const successOrder = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Notify Buyer',
        email: 'notify@example.com',
        phone: '3007111111',
      },
      shipping: {
        address: 'Notify street',
        city: 'Bogota',
      },
      items: [
        {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    assert.equal(successOrder.status, 201);

    const sentNotifications = await waitFor(
      () =>
        prisma.notification.findMany({
          where: {
            eventName: 'order.created',
            recipient: {
              in: ['notify@example.com', 'ops@internal'],
            },
          },
        }),
      (rows) => rows.length >= 2 && rows.every((row) => row.status === 'sent'),
    );

    assert.equal(sentNotifications.length >= 2, true);

    const failureOrder = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Fail Notify Buyer',
        email: 'fail-email@example.com',
        phone: '3007222222',
      },
      shipping: {
        address: 'Fail notify street',
        city: 'Bogota',
      },
      items: [
        {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    assert.equal(failureOrder.status, 201);

    const failedNotification = await waitFor(
      () =>
        prisma.notification.findFirst({
          where: {
            eventName: 'order.created',
            recipient: 'fail-email@example.com',
          },
        }),
      (row) => !!row && row.status === 'failed' && row.attempts >= 3,
    );

    assert.equal(failedNotification?.status, 'failed');

    const history = await http
      .get('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(history.status, 200);
    assert.equal(history.body.data.length >= 3, true);
  });

  await it('publica contenido, lo expone públicamente y lo indexa en búsqueda', async () => {
    const create = await http
      .post('/api/v1/admin/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Hero Industrial April',
        slug: 'hero-industrial-april',
        type: 'hero',
        placementKey: 'home.hero',
        body: {
          text: 'Potencia industrial para tu operación',
        },
        priority: 50,
      });
    assert.equal(create.status, 201);

    const beforePublish = await http.get('/api/v1/content').query({ placementKey: 'home.hero' });
    assert.equal(beforePublish.status, 200);
    assert.equal(beforePublish.body.data.length, 0);

    const publish = await http
      .patch(`/api/v1/admin/content/${create.body.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(publish.status, 200);

    const publicContent = await http.get('/api/v1/content').query({ placementKey: 'home.hero' });
    assert.equal(publicContent.status, 200);
    assert.equal(publicContent.body.data.length, 1);

    const search = await http.get('/api/v1/search').query({ q: 'Potencia industrial' });
    assert.equal(search.status, 200);
    assert.equal(
      search.body.data.some((entry: { documentType: string }) => entry.documentType === 'content'),
      true,
    );
  });

  await it('aplica promociones de forma determinística y mantiene snapshot correcto en pedidos', async () => {
    const promoHigh = await http
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Variant 10',
        slug: 'variant-10',
        type: 'percentage',
        scope: 'line',
        stackingMode: 'exclusive',
        priority: 20,
        value: '10.00',
        targetType: 'variant',
        targetIds: [seeded.inventory.variantId],
        isActive: true,
      });
    assert.equal(promoHigh.status, 201);

    const promoLow = await http
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Variant 5',
        slug: 'variant-5',
        type: 'percentage',
        scope: 'line',
        stackingMode: 'exclusive',
        priority: 10,
        value: '5.00',
        targetType: 'variant',
        targetIds: [seeded.inventory.variantId],
        isActive: true,
      });
    assert.equal(promoLow.status, 201);

    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Promo Buyer',
        email: 'promo@example.com',
        phone: '3007333333',
      },
      shipping: {
        address: 'Promo street',
        city: 'Bogota',
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
    assert.equal(order.body.order.totals.discountTotal, '34990.00');
    assert.equal(order.body.order.items[0].lineDiscountTotal, '34990.00');
    assert.equal(order.body.order.items[0].appliedPromotionIds.length, 1);

    const sameOrder = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Promo Buyer Two',
        email: 'promo-two@example.com',
        phone: '3007444444',
      },
      shipping: {
        address: 'Promo street',
        city: 'Bogota',
      },
      items: [
        {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    assert.equal(sameOrder.body.order.totals.discountTotal, '34990.00');
  });

  await it('indexa variantes y expone reportes operativos en analytics', async () => {
    const reindex = await http
      .post('/api/v1/admin/search/reindex/variants')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(reindex.status, 201);

    const search = await http.get('/api/v1/search').query({ q: 'TOTAL-DEMO-001' });
    assert.equal(search.status, 200);
    assert.equal(
      search.body.data.some((entry: { sku: string }) => entry.sku === 'TOTAL-DEMO-001'),
      true,
    );

    const autocomplete = await http.get('/api/v1/search/autocomplete').query({ q: 'TOTAL-DEMO' });
    assert.equal(autocomplete.status, 200);
    assert.equal(autocomplete.body.data.includes('TOTAL-DEMO-001'), true);

    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Analytics Buyer',
        email: 'analytics@example.com',
        phone: '3007555555',
      },
      shipping: {
        address: 'Analytics street',
        city: 'Bogota',
      },
      items: [
        {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    assert.equal(order.status, 201);

    const paymentIntent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    assert.equal(paymentIntent.status, 201);

    const payload = JSON.stringify({
      eventId: 'evt-analytics-1',
      gatewayReference: paymentIntent.body.payment.gatewayReference,
      transactionId: 'txn-analytics-1',
      status: 'approved',
    });

    const webhook = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    assert.equal(webhook.status, 201);

    const salesSummary = await http
      .get('/api/v1/admin/analytics/sales-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(salesSummary.status, 200);
    assert.equal(Number(salesSummary.body.orderCount) >= 1, true);
    assert.equal(Number(salesSummary.body.netRevenue) > 0, true);

    const topProducts = await http
      .get('/api/v1/admin/analytics/top-products')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(topProducts.status, 200);
    assert.equal(topProducts.body.data.length >= 1, true);

    const refresh = await http
      .post('/api/v1/admin/analytics/refresh')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(refresh.status, 201);

    const snapshot = await prisma.analyticsSnapshot.findFirst({
      where: {
        reportKey: 'sales_summary',
      },
    });
    assert.ok(snapshot);
  });
});
