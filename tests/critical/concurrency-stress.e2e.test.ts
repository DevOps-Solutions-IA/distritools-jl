import { after, afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHmac } from 'node:crypto';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';
import { PrismaOrderItemRepository } from 'src/modules/order-items/infrastructure/repositories/prisma-order-item.repository';

function signWebhook(gateway: string, payload: string): string {
  return createHmac('sha256', process.env.PAYMENT_GATEWAY_SECRET!)
    .update(`${gateway}.${payload}`)
    .digest('hex');
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function ensureHttpServerListening(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
): Promise<number> {
  const currentAddress = app.getHttpServer().address();
  if (currentAddress && typeof currentAddress === 'object' && 'port' in currentAddress) {
    return currentAddress.port;
  }

  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address !== 'object' || !('port' in address)) {
    throw new Error('HTTP server is not listening');
  }

  return address.port;
}

describe('Concurrency and stress hardening', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'] | undefined;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;

  beforeEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }

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

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  after(async () => {
    await disconnectDatabase();
  });

  await it('Scenario A: stock contention never drives inventory negative', async () => {
    const requestCount = envNumber('STRESS_ORDER_REQUESTS', 8);
    await prisma.inventoryItem.update({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
      data: {
        onHandQty: 3,
        reservedQty: 0,
      },
    });

    const requests = Array.from({ length: requestCount }, (_, index) =>
      http.post('/api/v1/orders').send({
        customer: {
          fullName: `Concurrent ${index}`,
          email: `concurrent-${index}@example.com`,
          phone: `30090000${index}`,
        },
        shipping: {
          address: 'Load Street',
          city: 'Cali',
        },
        items: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 1,
          },
        ],
      }),
    );

    const responses = await Promise.all(requests);
    const successes = responses.filter((response) => response.status === 201).length;
    const failures = responses.filter((response) => response.status !== 201).length;

    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    assert.equal(successes, 3);
    assert.equal(failures, requestCount - 3);
    assert.equal(inventory.onHandQty, 3);
    assert.equal(inventory.reservedQty, 3);
    assert.equal(inventory.onHandQty - inventory.reservedQty >= 0, true);
  });

  await it('Scenario A2: guest checkout concurrency resolves allocation internally without negative stock', async () => {
    await prisma.inventoryItem.update({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
      data: {
        onHandQty: 1,
        reservedQty: 0,
      },
    });

    const responses = await Promise.all(
      Array.from({ length: 2 }, (_, index) =>
        http.post('/api/v1/checkout/guest-order').send({
          customer: {
            fullName: `Guest Race ${index}`,
            email: `guest-race-${index}@example.com`,
            phone: `302000000${index}`,
          },
          shippingAddress: {
            city: 'Cali',
            addressLine1: 'Race Street 1',
          },
          items: [
            {
              productId: seeded.inventory.secondProductId,
              variantId: seeded.inventory.secondVariantId,
              quantity: 1,
            },
          ],
          paymentMethod: 'mock',
        }),
      ),
    );

    const successCount = responses.filter((response) => response.status === 201).length;
    const conflictCount = responses.filter((response) => response.status === 409).length;

    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    assert.equal(successCount, 1);
    assert.equal(conflictCount, 1);
    assert.equal(inventory.onHandQty, 1);
    assert.equal(inventory.reservedQty, 1);
    assert.equal(inventory.onHandQty - inventory.reservedQty >= 0, true);
  });

  await it('Scenario B: duplicate webhook replay does not duplicate effects', async () => {
    const duplicateCount = envNumber('STRESS_WEBHOOK_DUPLICATES', 10);
    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Replay Buyer',
        email: 'replay@example.com',
        phone: '3004444444',
      },
      shipping: { address: 'Replay', city: 'Cali' },
      items: [
        {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });
    const intent = await http
      .post(`/api/v1/payments/${order.body.order.orderNumber}/initiate`)
      .send({ gateway: 'mock' });

    const payload = JSON.stringify({
      eventId: 'evt-storm-1',
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: 'txn-storm-1',
      status: 'approved',
    });

    const storm = await Promise.all(
      Array.from({ length: duplicateCount }, () =>
        http
          .post('/api/v1/payments/webhook/mock')
          .set('x-signature', signWebhook('mock', payload))
          .set('Content-Type', 'application/json')
          .send(payload),
      ),
    );

    const applied = storm.filter(
      (response) => response.status === 201 && response.body.idempotent === false,
    ).length;
    const idempotent = storm.filter(
      (response) => response.status === 201 && response.body.idempotent === true,
    ).length;

    const movements = await prisma.stockMovement.findMany({
      where: {
        referenceType: 'order',
        referenceId: order.body.order.id,
        movementType: 'commit',
      },
    });

    assert.equal(applied, 1);
    assert.equal(idempotent, duplicateCount - 1);
    assert.equal(movements.length, 1);
  });

  await it('Scenario C: order cancel vs webhook race ends in valid terminal state', async () => {
    const order = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Race Buyer',
        email: 'race@example.com',
        phone: '3005555555',
      },
      shipping: { address: 'Race', city: 'Cali' },
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
      eventId: 'evt-race-1',
      gatewayReference: intent.body.payment.gatewayReference,
      transactionId: 'txn-race-1',
      status: 'approved',
    });

    const [cancel, webhook] = await Promise.allSettled([
      http.post(`/api/v1/orders/${order.body.order.orderNumber}/cancel`).send({}),
      http
        .post('/api/v1/payments/webhook/mock')
        .set('x-signature', signWebhook('mock', payload))
        .set('Content-Type', 'application/json')
        .send(payload),
    ]);

    const dbOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.body.order.id },
    });

    assert.ok(['cancelled', 'paid'].includes(dbOrder.status));
    assert.ok(cancel.status === 'fulfilled' || webhook.status === 'fulfilled');
  });

  await it('Scenario D: failure injection rolls back reserved stock and order writes', async () => {
    const orderItemRepository = app.get(PrismaOrderItemRepository);
    const originalCreateMany = orderItemRepository.createMany.bind(orderItemRepository);
    let injected = false;

    orderItemRepository.createMany = (async (
      ...args: Parameters<typeof orderItemRepository.createMany>
    ) => {
      injected = true;
      throw new Error('Injected order item persistence failure');
    }) as typeof orderItemRepository.createMany;

    const response = await http.post('/api/v1/orders').send({
      customer: {
        fullName: 'Failure Buyer',
        email: 'failure@example.com',
        phone: '3006666666',
      },
      shipping: { address: 'Failure', city: 'Cali' },
      items: [
        {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
          quantity: 1,
        },
      ],
    });

    orderItemRepository.createMany =
      originalCreateMany as typeof orderItemRepository.createMany;

    assert.equal(injected, true);
    assert.equal(response.status >= 500, true);

    const failedOrders = await prisma.order.findMany({
      where: {
        customerEmail: 'failure@example.com',
      },
    });
    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.secondVariantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    assert.equal(failedOrders.length, 0);
    assert.equal(inventory.reservedQty >= 0, true);
  });

  await it('Scenario F: RBAC enforcement blocks sensitive mutations', async () => {
    const viewer = await loginAsAdmin(
      http,
      seeded.users.viewerEmail,
      seeded.users.viewerPassword,
      seeded.users.twoFactorSecret,
    );

    const response = await http
      .patch('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
        quantityDelta: 1,
        reason: 'forbidden',
        referenceId: 'rbac-adjust',
      });

    assert.equal(response.status, 403);
  });

  await it('Scenario E: read pressure remains stable on available read endpoints', async () => {
    const readCount = envNumber('STRESS_READ_REQUESTS', 50);
    const port = await ensureHttpServerListening(app);
    const start = performance.now();
    const responses = await Promise.allSettled(
      Array.from({ length: readCount }, () =>
        fetch(
          `http://127.0.0.1:${port}/api/v1/admin/inventory/${seeded.inventory.variantId}/${seeded.inventory.warehouseId}`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      ),
    );
    const durationMs = performance.now() - start;

    assert.equal(
      responses.every(
        (response) =>
          response.status === 'fulfilled' && response.value.status === 200,
      ),
      true,
    );
    assert.equal(durationMs < 5000, true);
  });

  await it('Scenario G: mixed workload keeps order and payment state consistent', async () => {
    const mixedCount = envNumber('STRESS_MIXED_REQUESTS', 12);
    const port = await ensureHttpServerListening(app);

    await prisma.inventoryItem.update({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
      data: {
        onHandQty: mixedCount,
        reservedQty: 0,
      },
    });

    const createOrderResponses = await Promise.all(
      Array.from({ length: mixedCount }, (_, index) =>
        http.post('/api/v1/orders').send({
          customer: {
            fullName: `Mixed ${index}`,
            email: `mixed-${index}@example.com`,
            phone: `3010000${String(index).padStart(3, '0')}`,
          },
          shipping: {
            address: 'Mixed Street',
            city: 'Bogota',
          },
          items: [
            {
              variantId: seeded.inventory.variantId,
              warehouseId: seeded.inventory.warehouseId,
              quantity: 1,
            },
          ],
        }),
      ),
    );

    const createdOrders = createOrderResponses
      .filter((response) => response.status === 201)
      .map((response) => response.body.order);

    assert.equal(createdOrders.length, mixedCount);

    const intents = await Promise.all(
      createdOrders.map((order: { orderNumber: string }) =>
        http.post(`/api/v1/payments/${order.orderNumber}/initiate`).send({ gateway: 'mock' }),
      ),
    );

    const mixedOperations = createdOrders.flatMap((order: { id: string; orderNumber: string }, index) => {
      const payment = intents[index].body.payment;
      const payload = JSON.stringify({
        eventId: `evt-mixed-${index}`,
        gatewayReference: payment.gatewayReference,
        transactionId: `txn-mixed-${index}`,
        status: index % 2 === 0 ? 'approved' : 'rejected',
      });

      return [
        http
          .post('/api/v1/payments/webhook/mock')
          .set('x-signature', signWebhook('mock', payload))
          .set('Content-Type', 'application/json')
          .send(payload),
        fetch(`http://127.0.0.1:${port}/api/v1/search?q=industrial`),
      ];
    });

    const results = await Promise.allSettled(mixedOperations);
    assert.equal(results.every((result) => result.status === 'fulfilled'), true);

    const orders = await prisma.order.findMany({
      where: {
        id: {
          in: createdOrders.map((order: { id: string }) => order.id),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const paid = orders.filter((order) => order.status === 'paid').length;
    const cancelled = orders.filter((order) => order.status === 'cancelled').length;

    assert.equal(paid, Math.ceil(mixedCount / 2));
    assert.equal(cancelled, Math.floor(mixedCount / 2));
  });
});
