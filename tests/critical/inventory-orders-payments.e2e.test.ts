import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { PAYMENT_REPOSITORY, PaymentRepository } from 'src/modules/payments/domain/repositories/payment.repository';
import { PAYMENT_GATEWAY_PORT, PaymentGatewayPort } from 'src/modules/payments/application/ports/payment-gateway.port';
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

  await it('returns the same order for an identical idempotency key and conflicts on a different payload', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'idempotent@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const key = 'order-key-1';
    const payload = {
      customer: { fullName: 'Idempotent Buyer', email: 'idempotent@example.com', phone: '3001212133' },
      shipping: { address: 'Idempotent Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    };
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });

    const first = await http.post('/api/v1/orders').set('Idempotency-Key', key).send(payload);
    const retry = await http.post('/api/v1/orders').set('Idempotency-Key', key).send(payload);
    const conflict = await http.post('/api/v1/orders').set('Idempotency-Key', key).send({
      ...payload,
      items: [{ ...payload.items[0], quantity: 2 }],
    });

    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.order.id, first.body.order.id);
    assert.equal(retry.body.trackingCode, first.body.trackingCode);
    assert.equal(retry.body.trackingCode, `DTJL-TRK-${first.body.order.orderNumber.replace(/^DTJL-/, '')}`);
    assert.equal(conflict.status, 409);
    assert.equal(await prisma.order.count({ where: { orderNumber: first.body.order.orderNumber } }), 1);
    const after = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    assert.equal(after.reservedQty, before.reservedQty + 1);
  });

  await it('serializes concurrent order requests sharing an idempotency key', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'concurrent-idempotent@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const payload = {
      customer: { fullName: 'Concurrent Idempotent', email: 'concurrent-idempotent@example.com', phone: '3001212134' },
      shipping: { address: 'Concurrent Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 2 }],
    };
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    let arrived = 0;
    let release!: () => void;
    const start = new Promise<void>((resolve) => { release = resolve; });
    const send = async () => {
      arrived += 1;
      if (arrived === 2) release();
      await start;
      return http.post('/api/v1/orders').set('Idempotency-Key', 'ex062-concurrent-key-0001').send(payload);
    };

    const [first, second] = await Promise.all([send(), send()]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(first.body.order.id, second.body.order.id);
    const after = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    assert.equal(after.reservedQty, before.reservedQty + 2);
  });

  await it('rolls back order, reservation and outbox when order audit fails', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'audit-failure@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const beforeOrderCount = await prisma.order.count();
    const beforeOutboxCount = await prisma.domainEventOutbox.count();
    const beforeInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const originalWrite = audit.write.bind(audit);
    t.mock.method(audit, 'write', async (entry, tx) => {
      if (entry.action === 'order.created') {
        throw new Error('EX062_AUDIT_FAILURE');
      }
      return originalWrite(entry, tx);
    });

    const response = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Audit Failure Buyer',
        email: 'audit-failure@example.com',
        phone: '3001212130',
      },
      shipping: { address: 'Audit Street', city: 'Cali' },
      items: [{
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
        quantity: 1,
      }],
    });

    assert.equal(response.status, 500);
    assert.equal(await prisma.order.count(), beforeOrderCount);
    assert.equal(await prisma.domainEventOutbox.count(), beforeOutboxCount);
    const afterInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    assert.equal(afterInventory.onHandQty, beforeInventory.onHandQty);
    assert.equal(afterInventory.reservedQty, beforeInventory.reservedQty);
  });

  await it('rolls back cancellation state, stock release and event when cancellation audit fails', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'cancel-audit@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Cancel Audit Buyer', email: 'cancel-audit@example.com', phone: '3001212136' },
      shipping: { address: 'Cancel Audit Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    const beforeInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    const beforeOutboxCount = await prisma.domainEventOutbox.count();
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const originalWrite = audit.write.bind(audit);
    const failingAudit = t.mock.method(audit, 'write', async (entry, tx) => {
      if (entry.action === 'order.cancelled') throw new Error('EX062_CANCEL_AUDIT_FAILURE');
      return originalWrite(entry, tx);
    });

    const response = await http.post(`/api/v1/orders/${order.body.order.orderNumber}/cancel`).send({ reason: 'test fault' });
    assert.equal(response.status, 500);
    assert.equal(await prisma.order.findUniqueOrThrow({ where: { id: order.body.order.id } }).then((row) => row.status), 'pending_payment');
    assert.equal(await prisma.domainEventOutbox.count(), beforeOutboxCount);
    const afterInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    assert.equal(afterInventory.onHandQty, beforeInventory.onHandQty);
    assert.equal(afterInventory.reservedQty, beforeInventory.reservedQty);
    failingAudit.mock.restore();
    await http.post(`/api/v1/orders/${order.body.order.orderNumber}/cancel`).send({ reason: 'test cleanup' });
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
    assert.equal(typeof response.body.trackingCode, 'string');
    assert.equal(response.body.trackingCode.startsWith('DTJL-TRK-'), true);
    assert.equal(response.body.notification.status, 'queued');
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

    const tracking = await http.get('/api/v1/orders/track').query({
      query: response.body.trackingCode,
    });
    assert.equal(tracking.status, 200);
    assert.equal(tracking.body.orderNumber, response.body.orderNumber);
    assert.equal(tracking.body.trackingCode, response.body.trackingCode);
    assert.equal(tracking.body.trackingNumber, null);
    assert.equal(tracking.body.carrier, null);
    assert.equal(tracking.body.shippingStatus, 'pendiente_guia');
  });

  await it('guest checkout rejects unavailable PSE before creating an order or reserving stock', async () => {
    const beforeOrderCount = await prisma.order.count();
    const beforeInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'PSE Unavailable',
        email: 'pse-unavailable@example.com',
        phone: '3001212129',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 15',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: seeded.inventory.variantId,
          quantity: 1,
        },
      ],
      paymentMethod: 'pse',
    });

    assert.equal(response.status, 409);
    assert.match(response.body.message, /PSE provider is not configured/);
    assert.equal(await prisma.order.count(), beforeOrderCount);

    const afterInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    assert.equal(afterInventory.onHandQty, beforeInventory.onHandQty);
    assert.equal(afterInventory.reservedQty, beforeInventory.reservedQty);
  });

  await it('guest checkout replays the same order for an identical idempotency key', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'guest-idempotent@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const payload = {
      customer: { fullName: 'Guest Idempotent', email: 'guest-idempotent@example.com', phone: '3001212135' },
      shippingAddress: { city: 'Cali', addressLine1: 'Guest Idempotent Street' },
      items: [{ productId: seeded.inventory.productId, variantId: seeded.inventory.variantId, quantity: 1 }],
      paymentMethod: 'mock',
    };
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    const first = await http.post('/api/v1/checkout/guest-order').set('Idempotency-Key', 'ex062-guest-key-0001').send(payload);
    const retry = await http.post('/api/v1/checkout/guest-order').set('Idempotency-Key', 'ex062-guest-key-0001').send(payload);
    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.orderId, first.body.orderId);
    const after = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    assert.equal(after.reservedQty, before.reservedQty + 1);
  });

  await it('guest checkout hides missing variant technical identifiers', async () => {
    const missingVariantId = '019ddc5b-210e-771a-91b9-3a7b13ecf6a7';
    const response = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Guest Buyer',
        email: 'missing-variant@example.com',
        phone: '3001212199',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Guest Street 99',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: missingVariantId,
          quantity: 1,
        },
      ],
      paymentMethod: 'mock',
    });

    assert.equal(response.status, 404);
    assert.equal(
      response.body.message,
      'No pudimos confirmar uno de los productos del carrito. Actualiza tu carrito e inténtalo de nuevo.',
    );
    assert.equal(JSON.stringify(response.body).includes(missingVariantId), false);
    assert.equal(JSON.stringify(response.body).includes('Missing variants'), false);
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

    const conflictingPayload = JSON.stringify({
      eventId: 'evt-approved-1',
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: 'txn-conflicting-replay',
      status: 'rejected',
    });
    const conflictingReplay = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', conflictingPayload))
      .set('Content-Type', 'application/json')
      .send(conflictingPayload);
    assert.equal(conflictingReplay.status, 409);

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

  await it('reuses the existing pending payment intent for an identical retry', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'intent-retry@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Intent Retry Buyer', email: 'intent-retry@example.com', phone: '3001212132' },
      shipping: { address: 'Intent Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.secondVariantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    assert.equal(order.status, 201);

    const first = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    const retry = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });

    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.payment.id, first.body.payment.id);
    assert.equal(retry.body.payment.gatewayReference, first.body.payment.gatewayReference);
    assert.equal(await prisma.payment.count({ where: { orderId: order.body.order.id, gateway: 'mock' } }), 1);
    assert.equal(await prisma.domainEventOutbox.count({
      where: { eventName: 'payment.intent_created', payload: { path: ['paymentId'], equals: first.body.payment.id } },
    }), 1);
  });

  await it('serializes concurrent payment intent creation for the same order', async (t) => {
    let orderNumber: string | undefined;
    t.after(async () => {
      if (orderNumber) {
        await http.post(`/api/v1/orders/${orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Concurrent Intent Buyer', email: 'concurrent-intent@example.com', phone: '3001212140' },
      shipping: { address: 'Concurrent Intent Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    orderNumber = order.body.order.orderNumber;
    const gateway = app.get<PaymentGatewayPort>(PAYMENT_GATEWAY_PORT);
    const originalCreate = gateway.createIntent.bind(gateway);
    let arrivals = 0;
    let release!: () => void;
    const bothAtGateway = new Promise<void>((resolve) => { release = resolve; });
    t.mock.method(gateway, 'createIntent', async (...args: Parameters<typeof originalCreate>) => {
      arrivals += 1;
      if (arrivals === 2) release();
      let deadline: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          bothAtGateway,
          new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('payment intent barrier deadline')), 5000); }),
        ]);
      } finally {
        if (deadline) clearTimeout(deadline);
      }
      return originalCreate(...args);
    });

    const responses = await Promise.all([1, 2].map(() => http
      .post(`/api/v1/payments/${orderNumber}/initiate`)
      .send({ gateway: 'mock' })));
    assert.equal(responses.every((response) => response.status === 201), true);
    assert.equal(responses[0].body.payment.id, responses[1].body.payment.id);
    assert.equal(responses[0].body.payment.gatewayReference, responses[1].body.payment.gatewayReference);
    assert.equal(await prisma.payment.count({ where: { orderId: order.body.order.id } }), 1);
    assert.equal(await prisma.domainEventOutbox.count({
      where: { eventName: 'payment.intent_created', payload: { path: ['paymentId'], equals: responses[0].body.payment.id } },
    }), 1);
  });

  await it('rolls back payment intent and outbox when intent audit fails', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'intent-audit-failure@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Intent Audit Failure', email: 'intent-audit-failure@example.com', phone: '3001212139' },
      shipping: { address: 'Intent Audit Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.secondVariantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    const beforePaymentCount = await prisma.payment.count({ where: { orderId: order.body.order.id } });
    const beforeOutboxCount = await prisma.domainEventOutbox.count();
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const originalWrite = audit.write.bind(audit);
    t.mock.method(audit, 'write', async (entry, tx) => {
      if (entry.action === 'payment.intent_created') throw new Error('EX062_INTENT_AUDIT_FAILURE');
      return originalWrite(entry, tx);
    });

    const response = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    assert.equal(response.status, 500);
    assert.equal(await prisma.payment.count({ where: { orderId: order.body.order.id } }), beforePaymentCount);
    assert.equal(await prisma.domainEventOutbox.count(), beforeOutboxCount);
  });

  await it('serializes distinct approved and rejected webhook events to one terminal outcome', async (t) => {
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Webhook Race Buyer', email: 'webhook-race@example.com', phone: '3001212138' },
      shipping: { address: 'Webhook Race Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    const intent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    const payloads = ['approved', 'rejected'].map((status) => JSON.stringify({
      eventId: `evt-webhook-race-${status}`,
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: `txn-webhook-race-${status}`,
      status,
    }));
    const repository = app.get<PaymentRepository>(PAYMENT_REPOSITORY);
    const originalFind = repository.findByGatewayReference.bind(repository);
    let arrived = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    t.mock.method(repository, 'findByGatewayReference', async (...args: Parameters<typeof originalFind>) => {
      const payment = await originalFind(...args);
      arrived += 1;
      if (arrived === 2) release();
      let deadline: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          bothRead,
          new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('webhook barrier deadline')), 5000); }),
        ]);
      } finally {
        if (deadline) clearTimeout(deadline);
      }
      return payment;
    });

    const responses = await Promise.all(payloads.map((payload) => http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload)));

    assert.equal(responses.filter((response) => response.status === 201).length, 1);
    assert.equal(responses.filter((response) => response.status >= 400).length, 1);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: intent.body.payment.id } });
    const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.body.order.id } });
    const movements = await prisma.stockMovement.findMany({
      where: { referenceType: 'order', referenceId: order.body.order.id },
    });
    assert.ok(['approved', 'rejected'].includes(payment.status));
    assert.equal(dbOrder.status, payment.status === 'approved' ? 'paid' : 'cancelled');
    assert.equal(movements.filter((movement) => ['commit', 'release'].includes(movement.movementType)).length, 1);
    assert.equal(await prisma.webhookReceipt.count({ where: { gateway: 'mock', externalEventId: { in: ['evt-webhook-race-approved', 'evt-webhook-race-rejected'] } } }), 1);
  });

  await it('blocks mock payment intent creation in production and staging', async (t) => {
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Mock Blocked Buyer', email: 'mock-blocked@example.com', phone: '3001212137' },
      shipping: { address: 'Mock Blocked Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.secondVariantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    const previousAppEnv = process.env.APP_ENV;
    const previousNodeEnv = process.env.NODE_ENV;
    t.after(async () => {
      if (previousAppEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previousAppEnv;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      await http.post(`/api/v1/orders/${order.body.order.orderNumber}/cancel`).send({ reason: 'test cleanup' });
    });
    const beforePaymentCount = await prisma.payment.count({ where: { orderId: order.body.order.id } });
    for (const [environment, nodeEnvironment] of [
      ['production', 'test'],
      ['staging', 'test'],
      ['unrecognized', 'test'],
      ['local', 'production'],
    ]) {
      process.env.APP_ENV = environment;
      process.env.NODE_ENV = nodeEnvironment;
      const response = await http
        .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
        .send({ gateway: 'mock' });
      assert.equal(response.status, 409);
      assert.match(response.body.message, /Mock payment gateway is unavailable/);
    }
    assert.equal(await prisma.payment.count({ where: { orderId: order.body.order.id } }), beforePaymentCount);
  });

  await it('rolls back webhook receipt, payment, order and stock when audit fails', async (t) => {
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: 'webhook-audit@example.com' } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
    });
    const order = await http.post('/api/v1/orders').send({
      customer: { fullName: 'Webhook Audit Buyer', email: 'webhook-audit@example.com', phone: '3001212131' },
      shipping: { address: 'Webhook Street', city: 'Cali' },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
    const intent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });
    const payload = JSON.stringify({
      eventId: 'evt-audit-failure',
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: 'txn-audit-failure',
      status: 'approved',
    });
    const beforeInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    const beforeOutboxCount = await prisma.domainEventOutbox.count();
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const originalWrite = audit.write.bind(audit);
    t.mock.method(audit, 'write', async (entry, tx) => {
      if (entry.action === 'payment.webhook_processed') {
        throw new Error('EX062_WEBHOOK_AUDIT_FAILURE');
      }
      return originalWrite(entry, tx);
    });

    const response = await http
      .post('/api/v1/payments/webhook/mock')
      .set('x-signature', signWebhook('mock', payload))
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.equal(response.status, 500);
    assert.equal(await prisma.webhookReceipt.count({ where: { externalEventId: 'evt-audit-failure' } }), 0);
    assert.equal(await prisma.domainEventOutbox.count(), beforeOutboxCount);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: intent.body.payment.id } });
    const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.body.order.id } });
    const afterInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    assert.equal(payment.status, 'pending');
    assert.equal(dbOrder.status, 'pending_payment');
    assert.equal(afterInventory.onHandQty, beforeInventory.onHandQty);
    assert.equal(afterInventory.reservedQty, beforeInventory.reservedQty);
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
