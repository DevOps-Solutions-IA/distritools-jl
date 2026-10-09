import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { CreateGuestCheckoutOrderUseCase } from 'src/modules/orders/application/use-cases/create-guest-checkout-order.use-case';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

describe('EX-06.2 guest checkout idempotency after stale preflight', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let adminToken: string;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;

  before(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
    const admin = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    adminToken = admin.accessToken;
  });

  after(async () => {
    await app.close();
    await disconnectDatabase();
  });

  await it('returns the existing order when a stale preflight is followed by exhausted stock', async (t) => {
    const payload = {
      customer: { fullName: 'Guest Race', email: 'guest-race@example.com', phone: '3001212136' },
      shippingAddress: { city: 'Cali', addressLine1: 'Guest Race Street' },
      items: [{ productId: seeded.inventory.productId, variantId: seeded.inventory.variantId, quantity: 1 }],
      paymentMethod: 'mock',
    };
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    const originalAvailable = before.onHandQty - before.reservedQty - before.committedQty;
    assert.ok(originalAvailable >= 1);
    const stockDelta = 1 - originalAvailable;
    if (stockDelta !== 0) {
      const adjusted = await http.patch('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
          quantityDelta: stockDelta,
          reason: 'EX-06.2 deterministic guest idempotency race fixture',
          referenceId: 'ex062-guest-idempotency-race-stock',
        });
      assert.equal(adjusted.status, 200);
    }

    const payloadCustomerEmail = payload.customer.email;
    t.after(async () => {
      const leftovers = await prisma.order.findMany({ where: { customerEmail: payloadCustomerEmail } });
      for (const leftover of leftovers) {
        await http.post(`/api/v1/orders/${leftover.orderNumber}/cancel`).send({ reason: 'test cleanup' });
      }
      if (stockDelta !== 0) {
        const restored = await http.patch('/api/v1/admin/inventory/adjust')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantityDelta: -stockDelta,
            reason: 'restore EX-06.2 deterministic test fixture',
            referenceId: 'ex062-guest-idempotency-race-stock-restore',
          });
        assert.equal(restored.status, 200);
      }
    });

    const key = 'guest-key-1';
    const first = await http.post('/api/v1/checkout/guest-order').set('Idempotency-Key', key).send(payload);
    assert.equal(first.status, 201);

    const guestUseCase = app.get(CreateGuestCheckoutOrderUseCase) as unknown as { prisma: PrismaService };
    const originalPrisma = guestUseCase.prisma;
    const originalFind = originalPrisma.orderRequestIdempotency.findUnique.bind(originalPrisma.orderRequestIdempotency);
    const originalOrderFind = originalPrisma.order.findUnique.bind(originalPrisma.order);
    let stalePreflightInjected = false;
    guestUseCase.prisma = {
      orderRequestIdempotency: {
        findUnique: async (...args: Parameters<typeof originalFind>) => {
          if (!stalePreflightInjected) {
            stalePreflightInjected = true;
            return null;
          }
          return originalFind(...args);
        },
      },
      order: { findUnique: originalOrderFind },
    } as unknown as PrismaService;
    t.after(() => { guestUseCase.prisma = originalPrisma; });

    const retry = await http.post('/api/v1/checkout/guest-order').set('Idempotency-Key', key).send(payload);
    assert.equal(stalePreflightInjected, true);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.orderId, first.body.orderId);
    const after = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId } },
    });
    assert.equal(after.onHandQty, before.reservedQty + before.committedQty + 1);
    assert.equal(after.reservedQty, before.reservedQty + 1);
    assert.equal(await prisma.order.count({ where: { customerEmail: payloadCustomerEmail } }), 1);
  });
});
