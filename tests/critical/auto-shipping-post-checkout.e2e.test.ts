import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

const originalEnv = { ...process.env };

async function boot(env: Record<string, string | undefined>) {
  process.env = { ...originalEnv, ...env };
  await resetDatabase();
  const seeded = await seedBaseData();
  const testApp = await createTestApp();
  return { ...testApp, seeded };
}

function checkoutPayload(seeded: Awaited<ReturnType<typeof seedBaseData>>, overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      fullName: 'Auto Shipping Buyer',
      email: `auto-${Date.now()}@example.com`,
      phone: '3005559911',
      document: '901234567',
    },
    shippingAddress: {
      city: 'Cali',
      department: 'Valle del Cauca',
      daneCode: '76001000',
      addressLine1: 'Calle 99 # 1-20',
      notes: 'Prueba auto-shipping',
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
    ...overrides,
  };
}

describe('Auto-shipping post-checkout', () => {
  afterEach(async () => {
    process.env = { ...originalEnv };
    await disconnectDatabase();
  });

  it('creates order, quotes, selects cheapest carrier and creates mock guide without breaking checkout', async () => {
    const { app, http, seeded } = await boot({
      SHIPPING_PROVIDER: 'mock_99envios',
      NINETY_NINE_ENVIOS_ENABLE_COD: 'true',
      AUTO_SHIPPING_ENABLED: 'true',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      AUTO_SHIPPING_DEFAULT_WEIGHT_KG: '1',
      AUTO_SHIPPING_DEFAULT_LENGTH_CM: '20',
      AUTO_SHIPPING_DEFAULT_WIDTH_CM: '15',
      AUTO_SHIPPING_DEFAULT_HEIGHT_CM: '10',
    });

    const response = await http.post('/api/v1/checkout/guest-order').send(checkoutPayload(seeded));
    assert.equal(response.status, 201);
    assert.equal(response.body.shipping.autoShippingStatus, 'guide_created');
    assert.equal(response.body.shipping.carrier, 'tcc');
    assert.match(response.body.shipping.guideNumber, /^MOCK99-/);

    const shipment = await prisma.shipment.findFirstOrThrow({
      where: { orderId: response.body.orderId },
      include: { events: true },
    });
    assert.equal(shipment.status, 'guide_generated');
    assert.equal(shipment.provider, 'mock_99envios');
    assert.equal(shipment.providerReference, 'tcc');
    assert.match(shipment.trackingNumber ?? '', /^MOCK99-/);
    assert.equal(JSON.stringify(shipment.packageSnapshot).includes('selectedCarrier'), true);
    assert.equal(shipment.events.some((event) => event.providerStatus === 'shipment.carrier_selected'), true);

    const shippingEvents = await prisma.domainEventOutbox.findMany({
      where: { eventName: { in: ['shipment.quote_created', 'shipment.carrier_selected', 'shipment.guide_created'] } },
      include: { routingDecision: true },
      orderBy: { createdAt: 'asc' },
    });
    assert.deepEqual(shippingEvents.map((event) => event.eventName).sort(), [
      'shipment.carrier_selected', 'shipment.guide_created', 'shipment.quote_created',
    ]);
    assert.ok(shippingEvents.every((event) => event.routingDecision?.route === 'legacy_hold'));
    assert.ok(shippingEvents.every((event) => event.routingDecision?.eventId === event.eventId));

    const tracking = await http.get('/api/v1/orders/track').query({ query: response.body.trackingCode });
    assert.equal(tracking.status, 200);
    assert.equal(tracking.body.carrier, 'tcc');
    assert.match(tracking.body.trackingNumber, /^MOCK99-/);
    assert.equal(JSON.stringify(tracking.body).includes('auto-'), false);

    await app.close();
  });

  it('keeps checkout alive and creates admin alert when DANE is missing', async () => {
    const { app, http, seeded } = await boot({
      SHIPPING_PROVIDER: 'mock_99envios',
      AUTO_SHIPPING_ENABLED: 'true',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      AUTO_SHIPPING_REQUIRE_DANE: 'true',
      AUTO_SHIPPING_DEFAULT_WEIGHT_KG: '1',
      AUTO_SHIPPING_DEFAULT_LENGTH_CM: '20',
      AUTO_SHIPPING_DEFAULT_WIDTH_CM: '15',
      AUTO_SHIPPING_DEFAULT_HEIGHT_CM: '10',
    });

    const payload = checkoutPayload(seeded, {
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Calle 99 # 1-20',
        notes: 'Sin DANE',
      },
    });
    const response = await http.post('/api/v1/checkout/guest-order').send(payload);
    assert.equal(response.status, 201);
    assert.equal(response.body.shipping.autoShippingStatus, 'missing_dane');
    assert.equal(response.body.shipping.guideNumber, null);

    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: response.body.orderId } });
    assert.equal(shipment.status, 'pending_address');
    assert.equal(shipment.rawProviderStatus, 'missing_dane');
    assert.equal(shipment.trackingNumber, null);
    const alert = await prisma.notificationEvent.findFirst({ where: { entityId: response.body.orderId, errorCode: 'missing_dane' } });
    assert.ok(alert);

    await app.close();
  });

  it('does not fail checkout when real provider is not ready and avoids fake guide creation', async () => {
    const { app, http, seeded } = await boot({
      SHIPPING_PROVIDER: '99envios',
      AUTO_SHIPPING_ENABLED: 'true',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      AUTO_SHIPPING_DEFAULT_WEIGHT_KG: '1',
      AUTO_SHIPPING_DEFAULT_LENGTH_CM: '20',
      AUTO_SHIPPING_DEFAULT_WIDTH_CM: '15',
      AUTO_SHIPPING_DEFAULT_HEIGHT_CM: '10',
      NINETY_NINE_ENVIOS_AUTH_EMAIL: '',
      NINETY_NINE_ENVIOS_AUTH_PASSWORD: '',
    });

    const response = await http.post('/api/v1/checkout/guest-order').send(checkoutPayload(seeded));
    assert.equal(response.status, 201);
    assert.equal(response.body.shipping.autoShippingStatus, 'provider_not_ready');

    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: response.body.orderId } });
    assert.equal(shipment.provider, '99envios');
    assert.equal(shipment.status, 'pending_provider');
    assert.equal(shipment.trackingNumber, null);

    await app.close();
  });

  it('is idempotent and retry does not duplicate an existing guide', async () => {
    const { app, http, seeded } = await boot({
      SHIPPING_PROVIDER: 'mock_99envios',
      AUTO_SHIPPING_ENABLED: 'true',
      AUTO_SHIPPING_MODE: 'quote_and_create_guide',
      AUTO_SHIPPING_DEFAULT_WEIGHT_KG: '1',
      AUTO_SHIPPING_DEFAULT_LENGTH_CM: '20',
      AUTO_SHIPPING_DEFAULT_WIDTH_CM: '15',
      AUTO_SHIPPING_DEFAULT_HEIGHT_CM: '10',
    });

    const response = await http.post('/api/v1/checkout/guest-order').send(checkoutPayload(seeded));
    assert.equal(response.status, 201);
    const admin = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    const retry = await http.post(`/api/v1/admin/orders/${response.body.orderId}/auto-shipping/retry`).send({
      paymentMethod: 'cash_on_delivery',
      destinationDaneCode: '76001000',
    }).set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.status, 'already_has_guide');
    const count = await prisma.shipment.count({ where: { orderId: response.body.orderId } });
    assert.equal(count, 1);

    await app.close();
  });
});
