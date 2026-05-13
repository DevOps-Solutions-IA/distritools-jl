import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

const originalEnv = { ...process.env };

async function boot(env: Record<string, string | undefined>) {
  process.env = { ...originalEnv, ...env };
  await resetDatabase();
  const seeded = await seedBaseData();
  const testApp = await createTestApp();
  const admin = await loginAsAdmin(
    testApp.http,
    seeded.users.adminEmail,
    seeded.users.adminPassword,
    seeded.users.twoFactorSecret,
  );
  const viewer = await loginAsAdmin(
    testApp.http,
    seeded.users.viewerEmail,
    seeded.users.viewerPassword,
    seeded.users.twoFactorSecret,
  );
  return { ...testApp, seeded, adminToken: admin.accessToken, viewerToken: viewer.accessToken };
}

function checkoutPayload(seeded: Awaited<ReturnType<typeof seedBaseData>>) {
  return {
    customer: {
      fullName: 'Production Cleanup Buyer',
      email: `cleanup-${Date.now()}@example.com`,
      phone: '3005558844',
      document: '901234567',
    },
    shippingAddress: {
      city: 'Cali',
      department: 'Valle del Cauca',
      daneCode: '76001000',
      addressLine1: 'Calle 99 # 1-20',
      notes: 'Prueba limpieza producción',
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
  };
}

describe('Admin production cleanup', () => {
  afterEach(async () => {
    process.env = { ...originalEnv };
    await disconnectDatabase();
  });

  it('marks MOCK99 guides as mock/local and never as real 99 Envios', async () => {
    const { app, http, seeded, adminToken } = await boot({
      SHIPPING_PROVIDER: 'mock_99envios',
      NINETY_NINE_ENVIOS_ENABLE_COD: 'true',
      AUTO_SHIPPING_ENABLED: 'true',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      AUTO_SHIPPING_DEFAULT_WEIGHT_KG: '1',
      AUTO_SHIPPING_DEFAULT_LENGTH_CM: '20',
      AUTO_SHIPPING_DEFAULT_WIDTH_CM: '15',
      AUTO_SHIPPING_DEFAULT_HEIGHT_CM: '10',
    });

    const checkout = await http.post('/api/v1/checkout/guest-order').send(checkoutPayload(seeded));
    assert.equal(checkout.status, 201);
    assert.match(checkout.body.shipping.guideNumber, /^MOCK99-/);

    const shipments = await http
      .get('/api/v1/admin/shipments?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(shipments.status, 200);
    const shipment = shipments.body.data.find((row: { orderNumber: string }) => row.orderNumber === checkout.body.orderNumber);
    assert.ok(shipment);
    assert.equal(shipment.guideSource, 'mock_99envios');
    assert.equal(shipment.providerMode, 'mock_local');
    assert.equal(shipment.productionState, 'mock_local');
    assert.match(shipment.guideNotice, /No existe en panel real 99 Envíos/);
    assert.notEqual(shipment.guideNotice, 'Guía creada en 99 Envíos.');

    await app.close();
  });

  it('blocks production readiness when auth is disabled, mock provider is active, or credentials are missing', async () => {
    const { app, http, adminToken } = await boot({
      APP_ENV: 'production',
      ADMIN_AUTH_DISABLED: 'true',
      SHIPPING_PROVIDER: 'mock_99envios',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      NINETY_NINE_ENVIOS_AUTH_EMAIL: '',
      NINETY_NINE_ENVIOS_AUTH_PASSWORD: '',
    });

    const settings = await http
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(settings.status, 200);
    assert.equal(settings.body.productionReadiness.status, 'BLOCKED_FOR_PRODUCTION');
    assert.equal(settings.body.productionReadiness.mode, 'production_blocked');
    assert.equal(JSON.stringify(settings.body.productionReadiness).includes('Login admin desactivado'), true);
    assert.equal(JSON.stringify(settings.body.productionReadiness).includes('mock_99envios no puede operar como producción'), true);

    const validation = await http
      .post('/api/v1/admin/settings/providers/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    assert.equal(validation.status, 201);
    assert.equal(validation.body.valid, false);
    assert.equal(validation.body.failures.includes('mock_99envios bloqueado en producción.'), true);

    await app.close();
  });

  it('protects PDF and retry auto-shipping endpoints with server-side RBAC and keeps public tracking without PII', async () => {
    const { app, http, seeded, adminToken, viewerToken } = await boot({
      SHIPPING_PROVIDER: 'mock_99envios',
      AUTO_SHIPPING_ENABLED: 'true',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      AUTO_SHIPPING_DEFAULT_WEIGHT_KG: '1',
      AUTO_SHIPPING_DEFAULT_LENGTH_CM: '20',
      AUTO_SHIPPING_DEFAULT_WIDTH_CM: '15',
      AUTO_SHIPPING_DEFAULT_HEIGHT_CM: '10',
    });

    const checkout = await http.post('/api/v1/checkout/guest-order').send(checkoutPayload(seeded));
    assert.equal(checkout.status, 201);

    const shipments = await http
      .get('/api/v1/admin/shipments?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    const shipment = shipments.body.data.find((row: { orderNumber: string }) => row.orderNumber === checkout.body.orderNumber);
    assert.ok(shipment);

    const labelForbidden = await http
      .get(`/api/v1/admin/shipments/${shipment.id}/label`)
      .set('Authorization', `Bearer ${viewerToken}`);
    assert.equal(labelForbidden.status, 403);

    const retryForbidden = await http
      .post(`/api/v1/admin/orders/${checkout.body.orderId}/auto-shipping/retry`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(retryForbidden.status, 403);

    const publicTracking = await http.get('/api/v1/orders/track').query({ query: checkout.body.trackingCode });
    assert.equal(publicTracking.status, 200);
    assert.equal(JSON.stringify(publicTracking.body).includes('cleanup-'), false);
    assert.equal(JSON.stringify(publicTracking.body).includes('3005558844'), false);
    assert.equal(JSON.stringify(publicTracking.body).includes('Calle 99'), false);

    await app.close();
  });
});
