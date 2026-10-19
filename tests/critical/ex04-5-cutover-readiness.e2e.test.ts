import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma, resetDatabase, disconnectDatabase, seedBaseData } from 'tests/helpers/test-db';
import { VersionedDomainEvent } from 'src/common/events/domain-event.publisher';
import { PrismaDomainEventOutboxRepository } from 'src/infra/events/prisma-domain-event-outbox.repository';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { PrismaDomainEventParkingRepository } from 'src/infra/events/prisma-domain-event-parking.repository';
import { DomainEventOutboxRelay } from 'src/infra/events/domain-event-outbox-relay';
import { BullMqDomainEventPublisher } from 'src/infra/events/bullmq-domain-event.publisher';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';
import { DomainEventCutoverReadinessService } from 'src/infra/events/domain-event-cutover-readiness.service';
import { DomainEventQueueReconciler } from 'src/infra/events/domain-event-queue-reconciler';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { syntheticSecret } from 'tests/helpers/synthetic-secret';
import { createProducerRedisOptions } from 'src/infra/queue/redis-role-connection-options';

const EVENT_NAME = 'order.cancelled' as const;
const CONSUMER = 'notifications.v1';

function assertIsolatedTargets(): void {
  assert.equal(process.env.CI, 'true');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.APP_ENV, 'test');
  const db = new URL(process.env.DATABASE_URL!);
  assert.ok(['postgres:', 'postgresql:'].includes(db.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname));
  assert.ok(!['55440', '56379'].includes(db.port));
  assert.match(decodeURIComponent(db.pathname.slice(1)), /(?:^|[_-])test(?:[_-]|$)/i);
  const redis = new URL(process.env.REDIS_URL!);
  assert.equal(redis.protocol, 'redis:');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(redis.hostname));
  assert.ok(!['55440', '56379'].includes(redis.port));
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForLiveness(child: ChildProcess, port: number, deadlineMs: number): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Nest exited before liveness (${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(300) });
      if (response.status === 200) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error instanceof Error ? error.message : 'request failed'; }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Nest liveness deadline exceeded: ${lastError}`);
}

function createEvent(): VersionedDomainEvent & { eventId: string } {
  return {
    eventId: randomUUID(), eventName: EVENT_NAME, eventVersion: 'v1', occurredAt: new Date().toISOString(),
    payload: { orderId: randomUUID(), orderNumber: `EX045-${randomUUID()}`, status: 'cancelled', customerEmail: null, customerPhone: null },
  };
}

async function snapshotHeld(eventId: string): Promise<string> {
  const [outboxRow, routing, parkingRows] = await Promise.all([
    prisma.domainEventOutbox.findUnique({ where: { eventId } }),
    prisma.domainEventRoutingDecision.findUnique({ where: { eventId } }),
    prisma.domainEventParking.findMany({ where: { eventId }, orderBy: { consumerKey: 'asc' } }),
  ]);
  return JSON.stringify({ outboxRow, routing, parkingRows });
}

describe('EX-04.5 persisted routing and isolated cutover readiness', { concurrency: false, timeout: 300_000 }, () => {
  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
  redisUrl.pathname = '/15';
  const token = randomUUID().replaceAll('-', '');
  const queueName = `ex045-cutover-${token}`;
  let queue: Queue;
  let redis: Redis;
  let outbox: PrismaDomainEventOutboxRepository;
  let inbox: PrismaDomainEventInboxRepository;
  let parking: PrismaDomainEventParkingRepository;
  let registry: DomainEventHandlerRegistry;
  let legacy: InMemoryDomainEventPublisher;
  let relayPublisher: BullMqDomainEventPublisher;
  let queueEvents: Array<VersionedDomainEvent> = [];
  let historicalHeldId: string;
  let historicalHeldSnapshot: string;
  let persistedDurableId: string;
  let restoreEnv: { app: string | undefined; node: string | undefined; durable: string | undefined };

  before(async () => {
    assertIsolatedTargets();
    await resetDatabase();
    const historical = createEvent();
    historicalHeldId = historical.eventId;
    await prisma.domainEventOutbox.create({ data: {
      eventId: historical.eventId, eventName: historical.eventName, eventVersion: historical.eventVersion,
      payload: historical.payload as unknown as Prisma.InputJsonValue, occurredAt: new Date(historical.occurredAt),
    } });
    historicalHeldSnapshot = await snapshotHeld(historicalHeldId);
    restoreEnv = { app: process.env.APP_ENV, node: process.env.NODE_ENV, durable: process.env.EX045_TEST_DURABLE_ROUTING };
    queue = new Queue(queueName, { connection: createProducerRedisOptions(redisUrl.toString()) });
    redis = new Redis(redisUrl.toString(), { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    outbox = new PrismaDomainEventOutboxRepository(prisma as never, (registry = new DomainEventHandlerRegistry()));
    inbox = new PrismaDomainEventInboxRepository(prisma as never);
    parking = new PrismaDomainEventParkingRepository(prisma as never);
    registry.register(EVENT_NAME, CONSUMER, async (event) => {
      await inbox.runOnce(CONSUMER, event, async () => { queueEvents.push(event); });
    });
    legacy = new InMemoryDomainEventPublisher();
    relayPublisher = new BullMqDomainEventPublisher(queue as never, 1_500);
  });

  after(async () => {
    if (restoreEnv) {
      if (restoreEnv.app === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = restoreEnv.app;
      if (restoreEnv.node === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = restoreEnv.node;
      if (restoreEnv.durable === undefined) delete process.env.EX045_TEST_DURABLE_ROUTING; else process.env.EX045_TEST_DURABLE_ROUTING = restoreEnv.durable;
    }
    await queue?.obliterate({ force: true }).catch(() => undefined);
    await queue?.close().catch(() => undefined);
    redis?.disconnect();
    legacy?.onModuleDestroy();
    await disconnectDatabase();
  });

  it('persists route atomically across process reconstruction/config flips and never dual-dispatches', async () => {
    delete process.env.EX045_TEST_DURABLE_ROUTING;
    let legacyCount = 0;
    const unsubscribe = legacy.subscribe(EVENT_NAME, async () => { legacyCount += 1; });

    const held = createEvent();
    await prisma.$transaction(async (tx) => {
      const saved = await outbox.captureHeld(tx as never, held);
      assert.equal(saved.eventId, held.eventId);
      assert.equal(saved.route, 'legacy_hold');
    });
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';
    const heldDecision = await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: held.eventId } });
    assert.equal(heldDecision.route, 'legacy_hold');
    const restartedLegacy = new InMemoryDomainEventPublisher();
    let restartedLegacyCount = 0;
    restartedLegacy.subscribe(EVENT_NAME, async () => { restartedLegacyCount += 1; });
    const restartedOutbox = new PrismaDomainEventOutboxRepository(prisma as never, registry);
    const heldAfterRestart = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: held.eventId } });
    await restartedLegacy.publish({
      eventId: heldAfterRestart.eventId, eventName: heldAfterRestart.eventName as typeof EVENT_NAME,
      eventVersion: heldAfterRestart.eventVersion, occurredAt: heldAfterRestart.occurredAt.toISOString(),
      payload: heldAfterRestart.payload as never,
    }, heldDecision.route as 'legacy_hold');
    assert.equal(restartedLegacyCount, 1);
    assert.equal((await restartedOutbox.claimEligible(10, 5_000)).length, 0);

    const durable = createEvent();
    persistedDurableId = durable.eventId;
    await prisma.$transaction(async (tx) => { await outbox.captureHeld(tx as never, durable); });
    const durableDecision = await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: durable.eventId } });
    assert.equal(durableDecision.route, 'durable');
    const durableOutbox = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: durable.eventId } });
    assert.equal(durableOutbox.eligibility, 'cutover_pending');
    const legacyRelayVisible = await prisma.domainEventOutbox.count({
      where: { eventId: durable.eventId, eligibility: 'eligible' },
    });
    assert.equal(legacyRelayVisible, 0,
      'an EX-04.4 relay predicate must not see EX-04.5 durable intents during mixed deployment');
    await legacy.publish(durable, durableDecision.route as 'durable');
    assert.equal(legacyCount, 0, 'durable route suppresses legacy publication');

    process.env.EX045_TEST_DURABLE_ROUTING = 'false';
    assert.equal((await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: durable.eventId } })).route, 'durable');
    const durableAfterRestart = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: durable.eventId } });
    const durableRouteAfterRestart = await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: durable.eventId } });
    await restartedLegacy.publish({
      eventId: durableAfterRestart.eventId, eventName: durableAfterRestart.eventName as typeof EVENT_NAME,
      eventVersion: durableAfterRestart.eventVersion, occurredAt: durableAfterRestart.occurredAt.toISOString(),
      payload: durableAfterRestart.payload as never,
    }, durableRouteAfterRestart.route as 'durable');
    assert.equal(restartedLegacyCount, 1, 'a durable route stays suppressed after process reconstruction and rollback');
    const capturedAfterRollback = createEvent();
    await prisma.$transaction(async (tx) => { await outbox.captureHeld(tx as never, capturedAfterRollback); });
    const futureRoute = await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: capturedAfterRollback.eventId } });
    assert.equal(futureRoute.route, 'legacy_hold');
    await legacy.publish(capturedAfterRollback, futureRoute.route as 'legacy_hold');
    assert.equal(legacyCount, 1);
    const relay = new DomainEventOutboxRelay(outbox, relayPublisher);
    const enqueued = await relay.runIsolatedBatch({ batchSize: 1, leaseMs: 5_000 });
    assert.deepEqual(enqueued, { claimed: 1, enqueued: 1, failed: 0, lostClaims: 0 });
    const job = await queue.getJob(durable.eventId);
    assert.ok(job);
    assert.equal((job.data as { eventId: string }).eventId, durable.eventId);

    const worker = new DomainEventsWorker(registry, parking);
    await worker.process(job as never);
    await worker.process(job as never);
    assert.equal(queueEvents.length, 1);
    assert.deepEqual(await inbox.completedConsumerKeys(durable.eventId, [CONSUMER]), [CONSUMER]);
    assert.equal(legacyCount, 1);
    await job.remove();

    const pendingAfterQueueLoss = createEvent();
    await prisma.domainEventOutbox.create({ data: {
      eventId: pendingAfterQueueLoss.eventId, eventName: pendingAfterQueueLoss.eventName,
      eventVersion: pendingAfterQueueLoss.eventVersion, payload: pendingAfterQueueLoss.payload as unknown as Prisma.InputJsonValue,
      occurredAt: new Date(pendingAfterQueueLoss.occurredAt), eligibility: 'cutover_pending', holdReason: null,
      state: 'enqueued', enqueuedAt: new Date(), routingDecision: { create: {
        route: 'durable', reason: 'TEST_ONLY_DURABLE', policyVersion: 'ex045.v1',
      } },
    } });
    const reconciler = new DomainEventQueueReconciler(outbox, inbox, registry, queue as never, parking);
    await reconciler.reconcile(50);
    assert.equal(await queue.getJob(durable.eventId), undefined, 'completed PostgreSQL receipt must suppress reconstruction');
    const reconstructed = await queue.getJob(pendingAfterQueueLoss.eventId);
    assert.ok(reconstructed, 'pending PostgreSQL intent must reconstruct missing Redis job');
    assert.equal((reconstructed.data as { eventId: string }).eventId, pendingAfterQueueLoss.eventId);
    await reconstructed.remove();
    unsubscribe();
  });

  it('does not fall back to legacy if durable enqueue fails and validates Redis queue contract', async () => {
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';
    const event = createEvent();
    await prisma.$transaction(async (tx) => { await outbox.captureHeld(tx as never, event); });
    await prisma.$executeRaw`UPDATE domain_event_outbox SET created_at = '2000-01-01T00:00:00Z'::timestamptz WHERE event_id = ${event.eventId}::uuid`;
    let legacyCount = 0;
    const unsubscribe = legacy.subscribe(EVENT_NAME, async () => { legacyCount += 1; });
    const failingRelay = new DomainEventOutboxRelay(outbox, {
      publish: async () => { throw new Error('isolated enqueue failure'); },
    });
    const result = await failingRelay.runIsolatedBatch({ batchSize: 1, leaseMs: 5_000 });
    assert.equal(result.failed, 1);
    assert.equal(legacyCount, 0);
    const row = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: event.eventId } });
    assert.equal(row.state, 'pending');
    assert.equal(row.lastErrorCode, 'ENQUEUE_FAILED');
    assert.equal((await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: event.eventId } })).route, 'durable');
    unsubscribe();

    const config = Object.fromEntries([await redis.config('GET', 'maxmemory-policy')]);
    const appendonly = await redis.config('GET', 'appendonly');
    const appendfsync = await redis.config('GET', 'appendfsync');
    assert.equal(config['maxmemory-policy'], 'noeviction');
    assert.equal(appendonly[1], 'yes');
    assert.equal(appendfsync[1], 'always');
  });

  it('rolls back business intent and routing together; routing decisions reject mutation', async () => {
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';
    const rolledBack = createEvent();
    await assert.rejects(prisma.$transaction(async (tx) => {
      await outbox.captureHeld(tx as never, rolledBack);
      throw new Error('injected caller rollback');
    }), /injected caller rollback/);
    assert.equal(await prisma.domainEventOutbox.findUnique({ where: { eventId: rolledBack.eventId } }), null);
    assert.equal(await prisma.domainEventRoutingDecision.findUnique({ where: { eventId: rolledBack.eventId } }), null);

    const event = createEvent();
    await prisma.$transaction(async (tx) => { await outbox.captureHeld(tx as never, event); });
    const before = await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: event.eventId } });
    await assert.rejects(prisma.domainEventRoutingDecision.update({
      where: { eventId: event.eventId }, data: { route: 'legacy_hold' },
    }));
    assert.deepEqual(await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: event.eventId } }), before);
  });

  it('evaluates held/gapped history read-only, paginated and without payload or PII', async () => {
    delete process.env.EX045_TEST_DURABLE_ROUTING;
    const event = createEvent();
    await prisma.domainEventOutbox.create({ data: {
      eventId: event.eventId, eventName: event.eventName, eventVersion: event.eventVersion,
      payload: { ...event.payload, customerEmail: 'sensitive@example.test' } as unknown as Prisma.InputJsonValue,
      occurredAt: new Date(event.occurredAt), eligibility: 'held', holdReason: 'legacy_delivery_requires_reconciliation',
    } });
    const before = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: event.eventId } });
    const service = new DomainEventCutoverReadinessService(prisma as never, registry);
    const page = await service.evaluate({ limit: 50 });
    assert.equal(page.readOnly, true);
    assert.equal(page.bounded, true);
    assert.ok(page.consumerDispositionMatrix.some((entry) => entry.eventName === 'order.paid' && !entry.eligible));
    assert.ok(page.consumerDispositionMatrix.some((entry) => entry.eventName === 'inventory.low_stock_detected' && !entry.eligible));
    const item = page.items.find((entry) => entry.eventId === event.eventId);
    assert.ok(item);
    assert.equal(item.held, true);
    assert.equal(item.cutoverEligible, false);
    assert.equal(JSON.stringify(page).includes('sensitive@example.test'), false);
    assert.equal(JSON.stringify(page).includes('payload'), false);
    assert.deepEqual(await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: event.eventId } }), before);
    assert.equal(await snapshotHeld(historicalHeldId), historicalHeldSnapshot);
  });

  it('starts the real Nest process without queue Redis, serves liveness, fails readiness closed and shuts down bounded', async () => {
    const redisPort = await freePort();
    const appPort = await freePort();
    const unavailableRedis = new URL(`redis://127.0.0.1:${redisPort}`);
    const probe = createConnection({ host: '127.0.0.1', port: redisPort });
    await new Promise<void>((resolve) => probe.once('error', () => resolve()).once('connect', () => resolve()));
    assert.equal(probe.destroyed, true, 'test Redis endpoint must be absent before Nest startup');

    const child = spawn(process.execPath, ['-r', 'ts-node/register', 'src/main.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_PATH: '.', NODE_ENV: 'production', APP_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL!, REDIS_URL: unavailableRedis.toString(), PORT: String(appPort),
        CORS_ORIGINS: 'https://admin.example.test', ADMIN_AUTH_DISABLED: 'false',
        JWT_ACCESS_SECRET: syntheticSecret('access'),
        JWT_REFRESH_SECRET: syntheticSecret('refresh'),
        JWT_2FA_CHALLENGE_SECRET: syntheticSecret('challenge'),
        TWO_FACTOR_ENCRYPTION_KEY: syntheticSecret('two-factor-encryption'), EX045_TEST_DURABLE_ROUTING: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let childOutput = '';
    child.stdout?.on('data', (data: Buffer) => { childOutput += data.toString(); });
    child.stderr?.on('data', (data: Buffer) => { childOutput += data.toString(); });
    try {
      await waitForLiveness(child, appPort, 20_000).catch((error) => {
        throw new Error(`${error instanceof Error ? error.message : String(error)}\n${childOutput.slice(-4000)}`);
      });
      const readyStarted = Date.now();
      const readiness = await fetch(`http://127.0.0.1:${appPort}/api/v1/ready`, { signal: AbortSignal.timeout(2_000) });
      const readyBody = await readiness.json() as { ready: boolean; checks: Record<string, string> };
      assert.equal(readiness.status, 503);
      assert.equal(readyBody.ready, false);
      assert.equal(readyBody.checks.queueProducer, 'unavailable');
      assert.equal(readyBody.checks.queueWorker, 'not_required_for_api_role');
      assert.ok(Date.now() - readyStarted < 2_000);
      assert.equal((await fetch(`http://127.0.0.1:${appPort}/api/v1/admin/dashboard`, { signal: AbortSignal.timeout(1_000) })).status, 401);
      assert.equal((await prisma.domainEventRoutingDecision.findUniqueOrThrow({ where: { eventId: persistedDurableId } })).route, 'durable');
      assert.equal(await snapshotHeld(historicalHeldId), historicalHeldSnapshot);
    } finally {
      child.kill('SIGTERM');
      const exit = await Promise.race([
        child.exitCode !== null ? Promise.resolve({ exited: true, code: child.exitCode, signal: child.signalCode }) :
          new Promise<{ exited: true; code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
            child.once('exit', (code, signal) => resolve({ exited: true, code, signal }))),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Nest shutdown deadline exceeded: ${childOutput.slice(-2000)}`)), 8_000)),
      ]).catch(async (error) => { child.kill('SIGKILL'); throw error; });
      assert.equal(exit.exited, true);
      assert.notEqual(exit.signal, 'SIGKILL');
    }
  });

  it('protects the read-only cutover evaluator with authentication and its dedicated permission', async () => {
    await resetDatabase();
    const seeded = await seedBaseData();
    const { app, http } = await createTestApp();
    try {
      assert.equal((await http.get('/api/v1/admin/domain-events/cutover-readiness')).status, 401);
      const viewer = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
      assert.equal((await http.get('/api/v1/admin/domain-events/cutover-readiness')
        .set('Authorization', `Bearer ${viewer.accessToken}`)).status, 403);
      const admin = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
      const response = await http.get('/api/v1/admin/domain-events/cutover-readiness?limit=10')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      assert.equal(response.status, 200);
      assert.equal(response.body.readOnly, true);
      assert.equal(response.body.items.length <= 10, true);
      assert.equal(JSON.stringify(response.body).includes('payload'), false);
      assert.equal(JSON.stringify(response.body).includes('email'), false);
    } finally {
      await app.close();
    }
  });
});
