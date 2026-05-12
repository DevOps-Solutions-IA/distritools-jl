import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';
import { NinetyNineEnviosAdapter } from 'src/modules/shipping/infrastructure/providers/ninety-nine-envios.adapter';

describe('99 Envios API-ready shipping integration', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;
  let orderId: string;
  let orderNumber: string;
  let trackingCode: string;
  let shipmentId: string;

  before(async () => {
    process.env.SHIPPING_PROVIDER = 'mock_99envios';
    process.env.NINETY_NINE_ENVIOS_ENABLE_COD = 'true';
    process.env.NINETY_NINE_ENVIOS_WEBHOOK_SECRET = 'test-99envios-webhook-secret';
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
    adminToken = admin.accessToken;

    const order = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: '99 Envios Buyer',
        email: 'shipping99@example.com',
        phone: '3005559900',
        document: '901234567',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Calle 99 # 1-20',
        notes: 'Prueba logística 99 Envíos',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: seeded.inventory.variantId,
          quantity: 1,
        },
      ],
      deliveryMethod: 'standard',
      paymentMethod: 'cash_on_delivery',
    });
    assert.equal(order.status, 201);
    orderId = order.body.orderId;
    orderNumber = order.body.orderNumber;
    trackingCode = order.body.trackingCode;
  });

  after(async () => {
    delete process.env.SHIPPING_PROVIDER;
    delete process.env.NINETY_NINE_ENVIOS_ENABLE_COD;
    delete process.env.NINETY_NINE_ENVIOS_WEBHOOK_SECRET;
    await app.close();
    await disconnectDatabase();
  });

  await it('blocks real 99envios provider without official credentials', async () => {
    process.env.NINETY_NINE_ENVIOS_API_BASE_URL = 'https://integration.99envios.app';
    delete process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL;
    delete process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD;
    const adapter = new NinetyNineEnviosAdapter();
    const capabilities = await adapter.getCapabilities();
    assert.equal(capabilities.provider, '99envios');
    assert.equal(capabilities.ready, false);
    assert.equal(capabilities.mode, 'pending_provider');
    await assert.rejects(() => adapter.testConnection(), /blocked_missing_credentials/);
  });

  await it('quotes and creates mock 99envios guide only in local/test', async () => {
    const capabilities = await http
      .get('/api/v1/admin/shipping/capabilities')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(capabilities.status, 200);
    assert.equal(capabilities.body.provider, 'mock_99envios');
    assert.equal(capabilities.body.ready, true);

    const quote = await http
      .post('/api/v1/admin/shipping/quote')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId, cashOnDelivery: { enabled: true, amount: '1000.00' } });
    assert.equal(quote.status, 201);
    assert.equal(quote.body.provider, 'mock_99envios');
    assert.equal(quote.body.status, 'quoted');

    const shipment = await http
      .post(`/api/v1/admin/orders/${orderId}/shipment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cashOnDelivery: { enabled: true, amount: '1000.00' } });
    assert.equal(shipment.status, 201);
    assert.equal(shipment.body.provider, 'mock_99envios');
    assert.equal(shipment.body.trackingNumber.startsWith('MOCK99-'), true);
    shipmentId = shipment.body.id;
  });

  await it('exposes label, tracking, public tracking and COD without PII leakage', async () => {
    const label = await http
      .get(`/api/v1/admin/shipments/${shipmentId}/label`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(label.status, 200);
    assert.equal(typeof label.body.labelUrl, 'string');

    const tracking = await http
      .get(`/api/v1/admin/shipments/${shipmentId}/tracking`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(tracking.status, 200);
    assert.equal(tracking.body.providerStatus.trackingNumber.startsWith('MOCK99-'), true);

    const cod = await http
      .get(`/api/v1/admin/cod?shipmentId=${shipmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(cod.status, 200);
    assert.equal(cod.body.status, 'pending');

    const publicTracking = await http.get('/api/v1/orders/track').query({ query: trackingCode });
    assert.equal(publicTracking.status, 200);
    assert.equal(publicTracking.body.orderNumber, orderNumber);
    assert.equal(publicTracking.body.trackingNumber.startsWith('MOCK99-'), true);
    assert.equal(JSON.stringify(publicTracking.body).includes('shipping99@example.com'), false);
  });

  await it('validates 99envios webhook secret and is idempotent', async () => {
    const rejected = await http
      .post('/api/v1/webhooks/99envios')
      .set('x-99envios-signature', 'bad')
      .send({ eventId: 'evt-99-1', externalShipmentId: 'MOCK99-INVALID', status: 'delivered' });
    assert.equal(rejected.status, 401);

    const accepted = await http
      .post('/api/v1/webhooks/99envios')
      .set('x-99envios-signature', 'test-99envios-webhook-secret')
      .send({ eventId: 'evt-99-1', externalShipmentId: 'MOCK99-INVALID', status: 'delivered' });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.body.accepted, true);

    const duplicate = await http
      .post('/api/v1/webhooks/99envios')
      .set('x-99envios-signature', 'test-99envios-webhook-secret')
      .send({ eventId: 'evt-99-1', externalShipmentId: 'MOCK99-INVALID', status: 'delivered' });
    assert.equal(duplicate.status, 201);
    assert.equal(duplicate.body.duplicate, true);
  });
});
