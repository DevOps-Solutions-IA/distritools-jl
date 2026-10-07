import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';
import { DOMAIN_EVENT_PUBLISHER, VersionedDomainEvent } from 'src/common/events/domain-event.publisher';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY } from 'src/common/events/domain-event-outbox.port';
import { RequestContextService } from 'src/common/request/request-context.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { BullMqDomainEventPublisher } from 'src/infra/events/bullmq-domain-event.publisher';
import { PrismaDomainEventOutboxRepository } from 'src/infra/events/prisma-domain-event-outbox.repository';
import { DomainEventOutboxRelay } from 'src/infra/events/domain-event-outbox-relay';
import { AUDIT_REPOSITORY } from 'src/modules/auth/domain/repositories/audit.repository';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
import { INVENTORY_REPOSITORY } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { INVENTORY_REFERENCE_REPOSITORY } from 'src/modules/inventory/domain/repositories/inventory-reference.repository';
import { InventoryPolicyService } from 'src/modules/inventory/domain/services/inventory-policy.service';
import { PrismaInventoryRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory.repository';
import { PrismaInventoryReferenceRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory-reference.repository';
import { STOCK_MOVEMENT_REPOSITORY } from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import { PrismaStockMovementRepository } from 'src/modules/stock-movements/infrastructure/repositories/prisma-stock-movement.repository';
import { ORDER_ITEM_REPOSITORY } from 'src/modules/order-items/domain/repositories/order-item.repository';
import { PrismaOrderItemRepository } from 'src/modules/order-items/infrastructure/repositories/prisma-order-item.repository';
import { CreateOrderUseCase } from 'src/modules/orders/application/use-cases/create-order.use-case';
import { CancelOrderUseCase } from 'src/modules/orders/application/use-cases/cancel-order.use-case';
import { CREATE_ORDER_UNIT_OF_WORK } from 'src/modules/orders/application/ports/create-order-unit-of-work.port';
import { CANCEL_ORDER_UNIT_OF_WORK } from 'src/modules/orders/application/ports/cancel-order-unit-of-work.port';
import { ORDER_REPOSITORY } from 'src/modules/orders/domain/repositories/order.repository';
import { ORDER_VARIANT_REPOSITORY } from 'src/modules/orders/domain/repositories/order-variant.repository';
import { OrderNumberService } from 'src/modules/orders/domain/services/order-number.service';
import { OrderTrackingCodeService } from 'src/modules/orders/domain/services/order-tracking-code.service';
import { OrderPolicyService } from 'src/modules/orders/domain/services/order-policy.service';
import { PrismaOrderRepository } from 'src/modules/orders/infrastructure/repositories/prisma-order.repository';
import { PrismaOrderVariantRepository } from 'src/modules/orders/infrastructure/repositories/prisma-order-variant.repository';
import { PrismaCreateOrderUnitOfWork } from 'src/modules/orders/infrastructure/transactions/prisma-create-order-unit-of-work';
import { PrismaCancelOrderUnitOfWork } from 'src/modules/orders/infrastructure/transactions/prisma-cancel-order-unit-of-work';
import { EvaluatePromotionsUseCase } from 'src/modules/promotions/application/use-cases/evaluate-promotions.use-case';
import { PROMOTION_REPOSITORY } from 'src/modules/promotions/domain/repositories/promotion.repository';
import { PromotionEvaluatorService } from 'src/modules/promotions/domain/services/promotion-evaluator.service';
import { PrismaPromotionRepository } from 'src/modules/promotions/infrastructure/repositories/prisma-promotion.repository';
import { ProcessPaymentWebhookUseCase } from 'src/modules/payments/application/use-cases/process-payment-webhook.use-case';
import { PAYMENT_WEBHOOK_UNIT_OF_WORK } from 'src/modules/payments/application/ports/payment-webhook-unit-of-work.port';
import { PAYMENT_REPOSITORY } from 'src/modules/payments/domain/repositories/payment.repository';
import { PaymentPolicyService } from 'src/modules/payments/domain/services/payment-policy.service';
import { PaymentPayloadProtectionService } from 'src/modules/payments/domain/services/payment-payload-protection.service';
import { PrismaPaymentRepository } from 'src/modules/payments/infrastructure/repositories/prisma-payment.repository';
import { PrismaPaymentWebhookUnitOfWork } from 'src/modules/payments/infrastructure/transactions/prisma-payment-webhook-unit-of-work';
import { WEBHOOK_PARSER_PORT } from 'src/modules/webhooks/application/ports/webhook-parser.port';
import { WEBHOOK_SIGNATURE_PORT } from 'src/modules/webhooks/application/ports/webhook-signature.port';
import { WEBHOOK_RECEIPT_REPOSITORY } from 'src/modules/webhooks/domain/repositories/webhook-receipt.repository';
import { JsonWebhookParserService } from 'src/modules/webhooks/infrastructure/parsers/json-webhook-parser.service';
import { HmacWebhookSignatureService } from 'src/modules/webhooks/infrastructure/security/hmac-webhook-signature.service';
import { PrismaWebhookReceiptRepository } from 'src/modules/webhooks/infrastructure/repositories/prisma-webhook-receipt.repository';

const criticalNames = [
  'order.created', 'order.cancelled', 'payment.approved',
  'payment.rejected', 'payment.expired', 'order.paid',
] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fail before resetDatabase or opening transports; a local host alone is not a test target.
function assertIsolatedTargets(): void {
  assert.equal(process.env.CI, 'true', 'CI-owned disposable test services required');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.APP_ENV, 'test');
  const db = new URL(process.env.DATABASE_URL!);
  assert.ok(['postgres:', 'postgresql:'].includes(db.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname));
  assert.ok(!['55440', '56379'].includes(db.port), 'Shared developer services are forbidden');
  assert.match(decodeURIComponent(db.pathname.slice(1)), /(^|[_-])test([_-]|$)/i);
  assert.ok(!db.searchParams.has('host'), 'Do not override the loopback DB host');
  assert.ok(!db.searchParams.has('schema') || db.searchParams.get('schema') === 'public');
  const redis = new URL(process.env.REDIS_URL!);
  assert.equal(redis.protocol, 'redis:');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(redis.hostname));
  assert.ok(!['55440', '56379'].includes(redis.port), 'Shared developer services are forbidden');
}

function fixtureEvent(): VersionedDomainEvent {
  return {
    eventName: 'order.cancelled', eventVersion: 'v1',
    occurredAt: new Date().toISOString(), correlationId: randomUUID(),
    payload: {
      orderId: randomUUID(), orderNumber: `EX042-${randomUUID()}`,
      status: 'cancelled', customerEmail: null, customerPhone: null,
    },
  };
}

async function eligibleFixture() {
  const event = fixtureEvent();
  // This synthetic durable-only event is never sent to legacy subscribers.
  return prisma.domainEventOutbox.create({ data: {
    eventId: randomUUID(), eventName: event.eventName, eventVersion: event.eventVersion,
    payload: event.payload as Prisma.InputJsonValue, occurredAt: new Date(event.occurredAt),
    correlationId: event.correlationId, eligibility: 'eligible', holdReason: null,
    state: 'pending', nextAttemptAt: new Date(0),
  } });
}

async function businessSnapshot() {
  return {
    orders: await prisma.order.findMany({ orderBy: { id: 'asc' } }),
    items: await prisma.orderItem.findMany({ orderBy: { id: 'asc' } }),
    inventory: await prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } }),
    movements: await prisma.stockMovement.findMany({ orderBy: { id: 'asc' } }),
    payments: await prisma.payment.findMany({ orderBy: { id: 'asc' } }),
    receipts: await prisma.webhookReceipt.findMany({ orderBy: { id: 'asc' } }),
    outbox: await prisma.domainEventOutbox.findMany({ orderBy: { eventId: 'asc' } }),
  };
}

describe('EX-04.2 held capture and isolated durable transport', { concurrency: false, timeout: 300_000 }, () => {
  let moduleRef: TestingModule | undefined;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let db: PrismaService;
  let repository: PrismaDomainEventOutboxRepository;
  let legacy: InMemoryDomainEventPublisher;
  let published: VersionedDomainEvent[];
  let observerCompletions: Promise<void>[];
  let unsubscribers: Array<() => void> = [];
  const transports: Array<{ queue: Queue; redis: Redis }> = [];

  before(() => { assertIsolatedTargets(); });

  beforeEach(async () => {
    assertIsolatedTargets();
    await resetDatabase();
    seeded = await seedBaseData();
    published = [];
    observerCompletions = [];
    legacy = new InMemoryDomainEventPublisher();
    // Explicit providers exercise real use cases/transactions without importing AppModule,
    // creating a Worker, binding a socket, or instantiating business provider adapters.
    moduleRef = await Test.createTestingModule({ providers: [
      PrismaService, RequestContextService, PrismaDomainEventOutboxRepository,
      CreateOrderUseCase, CancelOrderUseCase, ProcessPaymentWebhookUseCase,
      ReserveStockUseCase, ReleaseStockUseCase, CommitStockUseCase,
      InventoryPolicyService, OrderPolicyService, OrderNumberService, OrderTrackingCodeService,
      EvaluatePromotionsUseCase, PromotionEvaluatorService,
      PaymentPolicyService, PaymentPayloadProtectionService,
      { provide: DOMAIN_EVENT_PUBLISHER, useValue: {
        publish: async (event: VersionedDomainEvent) => {
          assert.match(event.eventId!, uuidPattern);
          await legacy.publish(event);
        },
      } },
      { provide: DOMAIN_EVENT_OUTBOX_REPOSITORY, useExisting: PrismaDomainEventOutboxRepository },
      { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
      { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
      { provide: INVENTORY_REFERENCE_REPOSITORY, useClass: PrismaInventoryReferenceRepository },
      { provide: STOCK_MOVEMENT_REPOSITORY, useClass: PrismaStockMovementRepository },
      { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
      { provide: ORDER_VARIANT_REPOSITORY, useClass: PrismaOrderVariantRepository },
      { provide: ORDER_ITEM_REPOSITORY, useClass: PrismaOrderItemRepository },
      { provide: CREATE_ORDER_UNIT_OF_WORK, useClass: PrismaCreateOrderUnitOfWork },
      { provide: CANCEL_ORDER_UNIT_OF_WORK, useClass: PrismaCancelOrderUnitOfWork },
      { provide: PROMOTION_REPOSITORY, useClass: PrismaPromotionRepository },
      { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
      { provide: PAYMENT_WEBHOOK_UNIT_OF_WORK, useClass: PrismaPaymentWebhookUnitOfWork },
      { provide: WEBHOOK_PARSER_PORT, useClass: JsonWebhookParserService },
      { provide: WEBHOOK_SIGNATURE_PORT, useClass: HmacWebhookSignatureService },
      { provide: WEBHOOK_RECEIPT_REPOSITORY, useClass: PrismaWebhookReceiptRepository },
    ] }).compile();
    db = moduleRef.get(PrismaService);
    repository = moduleRef.get(PrismaDomainEventOutboxRepository);
    unsubscribers = criticalNames.map((name) => legacy.subscribe(name, (event) => {
      const completion = (async () => {
      assert.match(event.eventId!, uuidPattern);
      const row = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: event.eventId! } });
      assert.equal(row.eventName, event.eventName);
      assert.deepEqual(row.payload, event.payload);
      assert.equal(row.occurredAt.toISOString(), event.occurredAt);
      assert.equal(row.correlationId, event.correlationId ?? null);
      assert.equal(row.eligibility, 'held');
      assert.equal(row.state, 'pending');
      published.push(event as VersionedDomainEvent);
      })();
      observerCompletions.push(completion);
      return completion;
    }));
  });

  afterEach(async () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers = [];
    try {
      for (const { queue, redis } of transports.splice(0)) {
        try {
          assert.match(queue.name, /^ex042-/);
          if (redis.status !== 'ready') await redis.connect();
          await queue.obliterate({ force: true });
        } finally {
          await queue.close();
          redis.disconnect();
        }
      }
    } finally {
      await moduleRef?.close();
      moduleRef = undefined;
      legacy?.onModuleDestroy();
    }
  });
  after(async () => { await disconnectDatabase(); });

  function createOrder() {
    return moduleRef!.get(CreateOrderUseCase).execute({
      customer: { fullName: 'Outbox Buyer', email: 'ex042@example.test', phone: '3001112222' },
      shipping: { address: 'Isolated test address', city: 'Cali', shippingTotal: 0 },
      items: [{ variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 }],
    });
  }

  async function paymentFixture() {
    const { order } = await createOrder();
    const payment = await prisma.payment.create({ data: {
      id: randomUUID(), orderId: order.id, gateway: 'mock', gatewayReference: randomUUID(),
      amount: order.totals.grandTotal, currency: 'COP', status: 'pending',
    } });
    return { order, payment };
  }

  function webhook(gatewayReference: string, status: 'approved' | 'rejected' | 'expired') {
    const payload = JSON.stringify({ eventId: randomUUID(), gatewayReference, transactionId: randomUUID(), status });
    return {
      gateway: 'mock', payload,
      signature: createHmac('sha256', process.env.PAYMENT_GATEWAY_SECRET!).update(`mock.${payload}`).digest('hex'),
    };
  }

  async function assertHeld(names: readonly string[]) {
    // Failing listeners may leave earlier async observers in flight.
    await Promise.all(observerCompletions);
    const rows = await prisma.domainEventOutbox.findMany({ orderBy: { eventName: 'asc' } });
    assert.deepEqual(rows.map((row) => row.eventName), [...names].sort());
    for (const row of rows) {
      assert.match(row.eventId, uuidPattern);
      assert.equal(row.eventVersion, 'v1');
      assert.equal(row.eligibility, 'held');
      assert.ok(row.holdReason);
      assert.equal(row.state, 'pending');
      assert.equal(row.attempts, 0);
      assert.equal(row.claimToken, null);
      assert.equal(row.leaseUntil, null);
      assert.equal(row.enqueuedAt, null);
      assert.equal(row.lastErrorCode, null);
    }
    assert.deepEqual(published.map((event) => event.eventId).sort(), rows.map((row) => row.eventId).sort());
    return rows;
  }

  async function transport() {
    assertIsolatedTargets();
    const redis = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1,
      retryStrategy: () => null, connectTimeout: 1500, commandTimeout: 2000,
    });
    redis.on('error', () => { /* Queue.add must still reject; no automatic retry loop. */ });
    // Connect first: BullMQ also connects a lazy Redis instance during initialization.
    try { await redis.connect(); } catch (error) { redis.disconnect(); throw error; }
    const queue = new Queue(`ex042-${randomUUID()}`, { connection: redis, prefix: 'ex042' });
    queue.on('error', () => { /* Expected transport failures are asserted below. */ });
    transports.push({ queue, redis });
    await queue.waitUntilReady();
    return { queue, redis, publisher: new BullMqDomainEventPublisher(queue) };
  }

  it('CreateOrder and CancelOrder commit held intent and reuse the persisted ID in awaited legacy publication', async (t) => {
    const noQueue = t.mock.method(Queue.prototype, 'add', async () => { throw new Error('Normal runtime attempted durable enqueue'); });
    const originalPublish = legacy.publish.bind(legacy);
    const inputIds: string[] = [];
    t.mock.method(legacy, 'publish', async (event: VersionedDomainEvent) => {
      assert.match(event.eventId!, uuidPattern); // Before the in-memory publisher can enrich it.
      inputIds.push(event.eventId!);
      await originalPublish(event);
    });
    const stockBefore = await prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } });
    const { order } = await createOrder();
    assert.equal(order.status, 'pending_payment');
    const itemSnapshot = order.items[0];
    assert.ok(itemSnapshot && typeof itemSnapshot === 'object' && 'quantity' in itemSnapshot);
    assert.equal(itemSnapshot.quantity, 1);
    const reserved = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId_warehouseId: {
      variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId,
    } } });
    const initial = stockBefore.find((item) => item.id === reserved.id)!;
    assert.equal(reserved.reservedQty, initial.reservedQty + 1);
    await assertHeld(['order.created']);
    const cancelled = await moduleRef!.get(CancelOrderUseCase).execute({ orderNumber: order.orderNumber });
    assert.equal(cancelled.status, 'cancelled');
    const released = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: reserved.id } });
    assert.equal(released.reservedQty, initial.reservedQty);
    assert.equal(released.onHandQty, initial.onHandQty);
    const rows = await assertHeld(['order.created', 'order.cancelled']);
    assert.deepEqual(inputIds.sort(), rows.map((row) => row.eventId).sort());
    assert.equal(noQueue.mock.callCount(), 0);
  });

  for (const status of ['approved', 'rejected', 'expired'] as const) {
    it(`PaymentWebhook ${status} captures all intent atomically and replay preserves the exact pending rows`, async (t) => {
      const noQueue = t.mock.method(Queue.prototype, 'add', async () => { throw new Error('Normal runtime attempted durable enqueue'); });
      const { order, payment } = await paymentFixture();
      const input = webhook(payment.gatewayReference, status);
      const beforeStock = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId,
      } } });
      const result = await moduleRef!.get(ProcessPaymentWebhookUseCase).execute(input);
      assert.equal(result.idempotent, false);
      const rows = await assertHeld(['order.created', `payment.${status}`, ...(status === 'approved' ? ['order.paid'] : [])]);
      assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, status);
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, status === 'approved' ? 'paid' : 'cancelled');
      const afterStock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: beforeStock.id } });
      assert.equal(afterStock.reservedQty, beforeStock.reservedQty - 1);
      assert.equal(afterStock.onHandQty, beforeStock.onHandQty - (status === 'approved' ? 1 : 0));
      const snapshot = await businessSnapshot();
      const publicationCount = published.length;
      assert.deepEqual(await moduleRef!.get(ProcessPaymentWebhookUseCase).execute(input), { ok: true, idempotent: true });
      assert.deepEqual(await businessSnapshot(), snapshot);
      assert.equal(published.length, publicationCount);
      assert.deepEqual(await prisma.domainEventOutbox.findMany({ orderBy: { eventName: 'asc' } }), rows);
      assert.equal(noQueue.mock.callCount(), 0);
    });
  }

  for (const flow of ['create', 'cancel', 'approved', 'rejected', 'expired'] as const) {
    for (const failure of ['insert', 'after-capture'] as const) {
      it(`${flow}: ${failure} failure rolls back business, inventory, receipts and outbox together`, async (t) => {
        let execute: () => Promise<unknown>;
        if (flow === 'create') {
          execute = createOrder;
        } else if (flow === 'cancel') {
          const { order } = await createOrder();
          execute = () => moduleRef!.get(CancelOrderUseCase).execute({ orderNumber: order.orderNumber });
        } else {
          const { payment } = await paymentFixture();
          const input = webhook(payment.gatewayReference, flow);
          execute = () => moduleRef!.get(ProcessPaymentWebhookUseCase).execute(input);
        }
        const duplicate = failure === 'insert' ? await eligibleFixture() : null;
        const baseline = await businessSnapshot();
        const publicationCount = published.length;
        const original = repository.captureHeld.bind(repository);
        const capturedIds: string[] = [];
        const injection = t.mock.method(repository, 'captureHeld', async (
          tx: Parameters<PrismaDomainEventOutboxRepository['captureHeld']>[0],
          event: VersionedDomainEvent,
        ) => {
          assert.notEqual(tx, db);
          if (duplicate) {
            // Real PostgreSQL unique constraint failure, not a mocked rejected insert.
            await tx.domainEventOutbox.create({ data: {
              eventId: duplicate.eventId, eventName: event.eventName, eventVersion: event.eventVersion,
              payload: event.payload as Prisma.InputJsonValue, occurredAt: new Date(event.occurredAt),
              eligibility: 'held', holdReason: 'test', state: 'pending', nextAttemptAt: new Date(),
            } });
            assert.fail('Duplicate insert unexpectedly succeeded');
          }
          const captured = await original(tx, event);
          capturedIds.push(captured.eventId);
          assert.ok(await tx.domainEventOutbox.findUnique({ where: { eventId: captured.eventId } }));
          assert.equal(await prisma.domainEventOutbox.count({ where: { eventId: captured.eventId } }), 0);
          // Approval emits two records; throw after the second to prove both roll back.
          if (flow !== 'approved' || capturedIds.length === 2) throw new Error('EX042_POST_CAPTURE_ROLLBACK');
          return captured;
        });
        await assert.rejects(execute, (error: unknown) => duplicate
          ? error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
          : error instanceof Error && error.message === 'EX042_POST_CAPTURE_ROLLBACK');
        assert.equal(injection.mock.callCount(), failure === 'after-capture' && flow === 'approved' ? 2 : 1);
        assert.deepEqual(await businessSnapshot(), baseline);
        assert.equal(published.length, publicationCount);
        for (const eventId of capturedIds) assert.equal(await prisma.domainEventOutbox.count({ where: { eventId } }), 0);
      });
    }
  }

  it('legacy subscriber failure remains awaited; webhook replay retains both held approved/paid records without re-publication', async () => {
    const { order, payment } = await paymentFixture();
    const input = webhook(payment.gatewayReference, 'approved');
    const unsubscribe = legacy.subscribe('payment.approved', () => { throw new Error('EX042_LEGACY_FAILURE'); });
    try {
      await assert.rejects(moduleRef!.get(ProcessPaymentWebhookUseCase).execute(input), /EX042_LEGACY_FAILURE/);
    } finally { unsubscribe(); }
    // A synchronous failing listener does not cancel earlier async observers.
    // Await their actual completion before establishing the replay baseline.
    await Promise.all(observerCompletions);
    const snapshot = await businessSnapshot();
    assert.equal(snapshot.orders.find((row) => row.id === order.id)!.status, 'paid');
    assert.equal(snapshot.payments.find((row) => row.id === payment.id)!.status, 'approved');
    assert.ok(snapshot.receipts[0].processedAt);
    assert.deepEqual(snapshot.outbox.map((row) => row.eventName).sort(), ['order.created', 'order.paid', 'payment.approved']);
    assert.ok(snapshot.outbox.every((row) => row.eligibility === 'held' && row.state === 'pending' && row.enqueuedAt === null));
    const publicationCount = published.length;
    assert.deepEqual(await moduleRef!.get(ProcessPaymentWebhookUseCase).execute(input), { ok: true, idempotent: true });
    assert.deepEqual(await businessSnapshot(), snapshot);
    assert.equal(published.length, publicationCount);
    assert.deepEqual(await new PrismaDomainEventOutboxRepository(db).claimEligible(10, 30_000), []);
  });

  for (const flow of ['create', 'cancel'] as const) {
    it(`${flow}: awaited legacy failure does not delete or mark committed held intent enqueued`, async () => {
      const existing = flow === 'cancel' ? await createOrder() : null;
      const name = flow === 'create' ? 'order.created' : 'order.cancelled';
      const unsubscribe = legacy.subscribe(name, () => { throw new Error('EX042_LEGACY_FAILURE'); });
      try {
        await assert.rejects(flow === 'create' ? createOrder() : moduleRef!.get(CancelOrderUseCase).execute({
          orderNumber: existing!.order.orderNumber,
        }), /EX042_LEGACY_FAILURE/);
      } finally { unsubscribe(); }
      const orders = await prisma.order.findMany();
      assert.equal(orders.length, 1);
      assert.equal(orders[0].status, flow === 'create' ? 'pending_payment' : 'cancelled');
      await assertHeld(flow === 'create' ? ['order.created'] : ['order.created', 'order.cancelled']);
      assert.deepEqual(await repository.claimEligible(10, 30_000), []);
    });
  }

  it('held records remain unclaimable across repository/relay restart and never call Queue.add', async (t) => {
    await createOrder();
    const held = await assertHeld(['order.created']);
    const noQueue = t.mock.method(Queue.prototype, 'add', async () => { throw new Error('Held row was enqueued'); });
    // Construct an isolated publisher but no Redis connection: a held-only batch cannot use it.
    const unusedPublisher = { publish: async () => { assert.fail('Held row was published'); } };
    for (const key of ['NODE_ENV', 'APP_ENV'] as const) {
      const previous = process.env[key];
      try {
        process.env[key] = 'production';
        await assert.rejects(new DomainEventOutboxRelay(repository, unusedPublisher).runIsolatedBatch(), /OUTBOX_RELAY_DISABLED/);
      } finally { process.env[key] = previous; }
    }
    for (let restart = 0; restart < 2; restart += 1) {
      const restarted = new PrismaDomainEventOutboxRepository(db);
      assert.deepEqual(await restarted.claimEligible(5, 30_000), []);
      assert.deepEqual(await new DomainEventOutboxRelay(restarted, unusedPublisher).runIsolatedBatch({ batchSize: 5 }),
        { claimed: 0, enqueued: 0, failed: 0, lostClaims: 0 });
    }
    assert.deepEqual(await prisma.domainEventOutbox.findMany({ orderBy: { eventName: 'asc' } }), held);
    assert.equal(noQueue.mock.callCount(), 0);
  });

  it('real concurrent DB claims are bounded, disjoint, and leave no eligible row lost', async () => {
    const fixtures = await Promise.all(Array.from({ length: 9 }, () => eligibleFixture()));
    const second = new PrismaService();
    try {
      const other = new PrismaDomainEventOutboxRepository(second);
      const batches = await Promise.all([repository.claimEligible(4, 30_000), other.claimEligible(4, 30_000)]);
      assert.deepEqual(batches.map((batch) => batch.length), [4, 4]);
      const claims = [...batches.flat(), ...await other.claimEligible(9, 30_000)];
      assert.equal(claims.length, 9);
      assert.equal(new Set(claims.map((claim) => claim.eventId)).size, 9);
      assert.deepEqual(claims.map((claim) => claim.eventId).sort(), fixtures.map((row) => row.eventId).sort());
      for (const claim of claims) {
        assert.match(claim.claimToken, uuidPattern);
        assert.equal(claim.attempts, 1);
        assert.equal(await repository.markEnqueued(claim.eventId, claim.claimToken), true);
      }
      assert.equal(await prisma.domainEventOutbox.count({ where: { state: 'enqueued' } }), 9);
    } finally { await second.$disconnect(); }
  });

  it('expired lease is reclaimed with a new token; stale success/defer cannot overwrite the current owner', async () => {
    const row = await eligibleFixture();
    const [old] = await repository.claimEligible(1, 30_000);
    assert.equal(old.eventId, row.eventId);
    assert.deepEqual(await repository.claimEligible(1, 30_000), []);
    await prisma.domainEventOutbox.update({ where: { eventId: row.eventId }, data: { leaseUntil: new Date(0) } });
    const [current] = await new PrismaDomainEventOutboxRepository(db).claimEligible(1, 30_000);
    assert.equal(current.eventId, old.eventId);
    assert.notEqual(current.claimToken, old.claimToken);
    assert.equal(current.attempts, 2);
    const owned = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
    assert.equal(await repository.markEnqueued(old.eventId, old.claimToken), false);
    assert.equal(await repository.defer(old.eventId, old.claimToken, 'ENQUEUE_FAILED', 1000), false);
    assert.deepEqual(await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } }), owned);
    assert.equal(await repository.defer(current.eventId, current.claimToken, 'ENQUEUE_FAILED', 60_000), true);
    const deferred = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
    assert.equal(deferred.state, 'pending');
    assert.equal(deferred.claimToken, null);
    assert.equal(deferred.lastErrorCode, 'ENQUEUE_FAILED');
    assert.ok(deferred.nextAttemptAt.getTime() > Date.now());
    assert.deepEqual(await repository.claimEligible(1, 30_000), []);
    await prisma.domainEventOutbox.update({ where: { eventId: row.eventId }, data: { nextAttemptAt: new Date(0) } });
    const [retry] = await repository.claimEligible(1, 30_000);
    assert.equal(retry.eventId, row.eventId);
    assert.equal(retry.attempts, 3);
    assert.equal(await repository.markEnqueued(retry.eventId, retry.claimToken), true);
    const accepted = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
    assert.equal(accepted.state, 'enqueued');
    assert.ok(accepted.enqueuedAt);
    assert.equal(await repository.defer(current.eventId, current.claimToken, 'ENQUEUE_FAILED', 1000), false);
    assert.deepEqual(await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } }), accepted);
  });

  it('two real isolated relays enqueue each eligible event under its persisted BullMQ job ID with no worker', { timeout: 20_000 }, async () => {
    const fixtures = await Promise.all(Array.from({ length: 6 }, () => eligibleFixture()));
    const { queue, publisher } = await transport();
    const second = new PrismaService();
    try {
      const results = await Promise.all([
        new DomainEventOutboxRelay(repository, publisher).runIsolatedBatch({ batchSize: 3 }),
        new DomainEventOutboxRelay(new PrismaDomainEventOutboxRepository(second), publisher).runIsolatedBatch({ batchSize: 3 }),
      ]);
      assert.equal(results.reduce((sum, result) => sum + result.enqueued, 0), 6);
      assert.equal(results.reduce((sum, result) => sum + result.failed + result.lostClaims, 0), 0);
      for (const row of fixtures) {
        const job = await queue.getJob(row.eventId);
        assert.ok(job);
        assert.equal(job.id, row.eventId);
        assert.equal(job.name, row.eventName);
        assert.equal(job.data.eventId, row.eventId);
        assert.equal(job.data.eventVersion, row.eventVersion);
        assert.equal(job.data.occurredAt, row.occurredAt.toISOString());
        assert.equal(job.data.correlationId, row.correlationId);
        assert.deepEqual(job.data.payload, row.payload);
        assert.equal(await job.getState(), 'waiting'); // Acceptance, not consumer delivery.
        const accepted = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
        assert.equal(accepted.state, 'enqueued');
        assert.equal(accepted.attempts, 1);
        assert.ok(accepted.enqueuedAt);
      }
      assert.equal(await queue.getWaitingCount(), 6);
      assert.equal(await queue.getActiveCount(), 0);
      assert.equal(await queue.getCompletedCount(), 0);
      assert.equal(published.length, 0);
    } finally { await second.$disconnect(); }
  });

  it('a slow real enqueue loses expired ownership without overwriting the newer relay acceptance', { timeout: 20_000 }, async () => {
    const row = await eligibleFixture();
    const { queue, publisher } = await transport();
    let release!: () => void;
    let reached!: () => void;
    let rejectReached!: (error: unknown) => void;
    const resume = new Promise<void>((resolve) => { release = resolve; });
    const enqueued = new Promise<void>((resolve, reject) => { reached = resolve; rejectReached = reject; });
    const slowPublisher = { publish: async (event: VersionedDomainEvent) => {
      await publisher.publish(event);
      reached();
      await resume;
    } };
    const first = new DomainEventOutboxRelay(repository, slowPublisher).runIsolatedBatch({ batchSize: 1 });
    void first.catch(rejectReached);
    const second = new PrismaService();
    try {
      await enqueued;
      await prisma.domainEventOutbox.update({ where: { eventId: row.eventId }, data: { leaseUntil: new Date(0) } });
      assert.deepEqual(await new DomainEventOutboxRelay(new PrismaDomainEventOutboxRepository(second), publisher)
        .runIsolatedBatch({ batchSize: 1 }), { claimed: 1, enqueued: 1, failed: 0, lostClaims: 0 });
      const accepted = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
      release();
      assert.deepEqual(await first, { claimed: 1, enqueued: 0, failed: 0, lostClaims: 1 });
      assert.deepEqual(await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } }), accepted);
      assert.equal(accepted.attempts, 2);
      assert.equal(await queue.getWaitingCount(), 1);
      assert.equal(await queue.getCompletedCount(), 0);
      assert.equal(published.length, 0);
    } finally {
      release();
      await first.catch(() => undefined);
      await second.$disconnect();
    }
  });

  it('crash after actual BullMQ enqueue leaves an abandoned claim; restart deduplicates the same job ID', { timeout: 20_000 }, async (t) => {
    const row = await eligibleFixture();
    const { queue, publisher } = await transport();
    const mark = t.mock.method(repository, 'markEnqueued', async () => { throw new Error('EX042_CRASH_AFTER_ENQUEUE'); });
    // Simulate abrupt process death: the failed mark must not run failure bookkeeping.
    const defer = t.mock.method(repository, 'defer', async () => { assert.fail('Abrupt crash cannot run failure bookkeeping'); });
    await assert.rejects(
      new DomainEventOutboxRelay(repository, publisher).runIsolatedBatch({ batchSize: 1, leaseMs: 30_000 }),
      /EX042_CRASH_AFTER_ENQUEUE/,
    );
    assert.equal(mark.mock.callCount(), 1);
    assert.equal(defer.mock.callCount(), 0);
    assert.ok(await queue.getJob(row.eventId));
    const abandoned = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
    assert.equal(abandoned.state, 'claimed');
    assert.equal(abandoned.enqueuedAt, null);
    mark.mock.restore();
    defer.mock.restore();
    await prisma.domainEventOutbox.update({ where: { eventId: row.eventId }, data: { leaseUntil: new Date(0) } });
    const result = await new DomainEventOutboxRelay(new PrismaDomainEventOutboxRepository(db), publisher).runIsolatedBatch({ batchSize: 1 });
    assert.deepEqual(result, { claimed: 1, enqueued: 1, failed: 0, lostClaims: 0 });
    assert.equal(await queue.getWaitingCount(), 1);
    const accepted = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
    assert.equal(accepted.eventId, row.eventId);
    assert.equal(accepted.attempts, 2);
    assert.equal(accepted.state, 'enqueued');
    assert.equal(await prisma.domainEventOutbox.count(), 1);
    assert.equal(published.length, 0);
  });

  it('actual Redis connection failure leaves recoverable intent and reconnect retries the identical event/job ID', { timeout: 20_000 }, async () => {
    const row = await eligibleFixture();
    const { queue, redis, publisher } = await transport();
    redis.disconnect();
    const failed = await new DomainEventOutboxRelay(repository, publisher).runIsolatedBatch({ batchSize: 1 });
    assert.deepEqual(failed, { claimed: 1, enqueued: 0, failed: 1, lostClaims: 0 });
    const pending = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: row.eventId } });
    assert.equal(pending.eventId, row.eventId);
    assert.equal(pending.state, 'pending');
    assert.equal(pending.enqueuedAt, null);
    assert.equal(pending.claimToken, null);
    assert.ok(pending.lastErrorCode);
    await redis.connect();
    assert.equal(await queue.getWaitingCount(), 0);
    await prisma.domainEventOutbox.update({ where: { eventId: row.eventId }, data: { nextAttemptAt: new Date(0) } });
    const recovered = await new DomainEventOutboxRelay(new PrismaDomainEventOutboxRepository(db), publisher).runIsolatedBatch({ batchSize: 1 });
    assert.deepEqual(recovered, { claimed: 1, enqueued: 1, failed: 0, lostClaims: 0 });
    const job = await queue.getJob(row.eventId);
    assert.ok(job);
    assert.equal(job.id, row.eventId);
    assert.equal(job.data.eventId, row.eventId);
    assert.equal(await queue.getWaitingCount(), 1);
    assert.equal(await queue.getCompletedCount(), 0);
    assert.equal(await prisma.domainEventOutbox.count(), 1);
    assert.equal(published.length, 0);
  });
});
