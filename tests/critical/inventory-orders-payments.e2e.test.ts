import { after, before, describe, it } from 'node:test';
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

describe('Inventory, orders, payments, and webhooks', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;

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
    adminToken = admin.accessToken;
  });

  after(async () => {
    await app.close();
    await disconnectDatabase();
  });

  await it('adjust / reserve / release / commit preserve invariants', async () => {
    const adjust = await http
      .patch('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
        quantityDelta: 3,
        reason: 'restock',
        referenceId: 'adj-1',
      });
    assert.equal(adjust.status, 200);
    assert.equal(adjust.body.item.onHandQty, 8);

    const reserve = await http
      .post('/api/v1/admin/inventory/reserve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referenceType: 'test',
        referenceId: 'reserve-1',
        lines: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 2,
          },
        ],
      });
    assert.equal(reserve.status, 201);
    assert.equal(reserve.body.items[0].reservedQty, 2);
    assert.equal(reserve.body.items[0].availableQty, 6);

    const release = await http
      .post('/api/v1/admin/inventory/release')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referenceType: 'test',
        referenceId: 'reserve-1-release',
        lines: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 1,
          },
        ],
      });
    assert.equal(release.status, 201);
    assert.equal(release.body.items[0].reservedQty, 1);

    const commit = await http
      .post('/api/v1/admin/inventory/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referenceType: 'test',
        referenceId: 'reserve-1-commit',
        lines: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 1,
          },
        ],
      });
    assert.equal(commit.status, 201);
    assert.equal(commit.body.items[0].reservedQty, 0);
    assert.equal(commit.body.items[0].onHandQty, 7);
  });

  await it('rejects negative stock adjustment', async () => {
    const response = await http
      .patch('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        variantId: seeded.inventory.secondVariantId,
        warehouseId: seeded.inventory.warehouseId,
        quantityDelta: -5,
        reason: 'invalid',
        referenceId: 'adj-negative',
      });

    assert.equal(response.status, 409);
  });

  await it('creates order with stock reservation and immutable item snapshot', async () => {
    const response = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Buyer One',
        email: 'buyer1@example.com',
        phone: '3001111111',
      },
      shipping: {
        address: 'Street 1',
        city: 'Cali',
        shippingTotal: 10,
      },
      items: [
        {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 2,
        },
      ],
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.order.status, 'pending_payment');
    assert.equal(response.body.order.items[0].quantity, 2);

    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    assert.equal(inventory.reservedQty >= 2, true);
  });

  await it('guest checkout creates pending_payment order without warehouseId from frontend', async () => {
    const inventoryBefore = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Guest Buyer',
        email: 'guest@example.com',
        phone: '3001212121',
        document: '901234567',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 10',
        addressLine2: 'Bodega 2',
        notes: 'Porteria',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: seeded.inventory.variantId,
          quantity: 2,
        },
      ],
      deliveryMethod: 'standard',
      paymentMethod: 'mock',
      notes: 'Entrega diurna',
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.status, 'pending_payment');
    assert.equal(typeof response.body.orderNumber, 'string');
    assert.equal(response.body.payment.canInitiate, true);
    assert.equal(
      response.body.payment.initiateUrl,
      `/api/v1/payments/${response.body.orderNumber}/initiate`,
    );

    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'checkout.guest_order_created',
        entityId: response.body.orderId,
      },
    });

    assert.equal(inventory.reservedQty, inventoryBefore.reservedQty + 2);
    assert.equal(Boolean(audit), true);
  });

  await it('guest checkout rejects invalid variant product pairing', async () => {
    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Guest Buyer',
        email: 'invalid-pair@example.com',
        phone: '3001212122',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 11',
      },
      items: [
        {
          productId: seeded.inventory.secondProductId,
          variantId: seeded.inventory.variantId,
          quantity: 1,
        },
      ],
      paymentMethod: 'mock',
    });

    assert.equal(response.status, 422);
  });

  await it('guest checkout rejects inactive variant with 422', async () => {
    await prisma.variant.update({
      where: { id: seeded.inventory.variantId },
      data: { isActive: false },
    });

    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Guest Buyer',
        email: 'inactive@example.com',
        phone: '3001212123',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 12',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: seeded.inventory.variantId,
          quantity: 1,
        },
      ],
      paymentMethod: 'mock',
    });

    assert.equal(response.status, 422);

    await prisma.variant.update({
      where: { id: seeded.inventory.variantId },
      data: { isActive: true },
    });
  });

  await it('guest checkout fails with 400 on invalid quantity', async () => {
    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Guest Buyer',
        email: 'invalid-qty@example.com',
        phone: '3001212124',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 13',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: seeded.inventory.variantId,
          quantity: 0,
        },
      ],
      paymentMethod: 'mock',
    });

    assert.equal(response.status, 400);
  });

  await it('guest checkout fails with 409 on insufficient stock and never goes negative', async () => {
    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Guest Buyer',
        email: 'no-stock@example.com',
        phone: '3001212125',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 14',
      },
      items: [
        {
          productId: seeded.inventory.secondProductId,
          variantId: seeded.inventory.secondVariantId,
          quantity: 99,
        },
      ],
      paymentMethod: 'mock',
    });

    assert.equal(response.status, 409);

    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    assert.equal(inventory.onHandQty >= 0, true);
    assert.equal(inventory.reservedQty >= 0, true);
    assert.equal(inventory.onHandQty - inventory.reservedQty >= 0, true);
  });

  await it('payment approval via webhook commits stock exactly once', async () => {
    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Buyer Two',
        email: 'buyer2@example.com',
        phone: '3002222222',
      },
      shipping: {
        address: 'Street 2',
        city: 'Cali',
        shippingTotal: 0,
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

    const intent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    assert.equal(intent.status, 201);

    const payload = JSON.stringify({
      eventId: 'evt-approved-1',
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: 'txn-approved-1',
      status: 'approved',
    });

    const first = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    assert.equal(first.status, 201);
    assert.equal(first.body.idempotent, false);

    const second = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    assert.equal(second.status, 201);
    assert.equal(second.body.idempotent, true);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: intent.body.payment.id },
    });
    const dbOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.body.order.id },
    });
    const item = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    assert.equal(payment.status, 'approved');
    assert.equal(dbOrder.status, 'paid');
    assert.equal(item.onHandQty, 1);
    assert.equal(item.reservedQty, 0);
  });

  await it('invalid webhook signature is rejected', async () => {
    const response = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', 'tampered')
      .send({
        eventId: 'evt-invalid',
        gatewayReference: 'missing',
        status: 'approved',
      });

    assert.equal(response.status, 401);
  });

  await it('rejected payment releases stock and cancels order', async () => {
    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Buyer Three',
        email: 'buyer3@example.com',
        phone: '3003333333',
      },
      shipping: {
        address: 'Street 3',
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
    const intent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });

    const payload = JSON.stringify({
      eventId: 'evt-rejected-1',
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: 'txn-rejected-1',
      status: 'rejected',
    });

    const response = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    assert.equal(response.status, 201);

    const dbOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.body.order.id },
    });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: intent.body.payment.id },
    });
    const item = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    assert.equal(dbOrder.status, 'cancelled');
    assert.equal(payment.status, 'rejected');
    assert.equal(item.reservedQty >= 0, true);
  });
});
