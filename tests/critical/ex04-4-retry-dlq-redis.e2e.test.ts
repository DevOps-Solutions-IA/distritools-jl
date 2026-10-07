import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';
import { VersionedDomainEvent } from 'src/common/events/domain-event.publisher';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { PrismaDomainEventOutboxRepository } from 'src/infra/events/prisma-domain-event-outbox.repository';
import { PrismaDomainEventParkingRepository } from 'src/infra/events/prisma-domain-event-parking.repository';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';
import { DomainEventOutboxRelay } from 'src/infra/events/domain-event-outbox-relay';
import { BullMqDomainEventPublisher } from 'src/infra/events/bullmq-domain-event.publisher';
import { DomainEventQueueReconciler } from 'src/infra/events/domain-event-queue-reconciler';
import { DomainEventReplayService } from 'src/infra/events/domain-event-replay.service';
import { NotificationTemplateService } from 'src/modules/notifications/domain/services/notification-template.service';
import { PrismaNotificationRepository } from 'src/modules/notifications/infrastructure/repositories/prisma-notification.repository';
import { NotificationDispatchRecoveryService } from 'src/modules/notifications/infrastructure/queue/notification-dispatch-recovery.service';
import { QueueNotificationsFromEventUseCase } from 'src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case';
import { NotificationsEventSubscriber } from 'src/modules/notifications/infrastructure/queue/notifications-event.subscriber';
import { NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';
import { createProducerRedisOptions, createWorkerRedisOptions } from 'src/infra/queue/redis-role-connection-options';
import { boundedWorkerShutdown } from 'src/infra/queue/bounded-worker-shutdown';

const TEST_PREFIX = `ex044-${randomUUID()}`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertIsolatedTargets(): void {
  assert.equal(process.env.CI, 'true');
  assert.equal(process.env.APP_ENV, 'test');
  assert.equal(process.env.NODE_ENV, 'test');
  const database = new URL(process.env.DATABASE_URL!);
  assert.match(decodeURIComponent(database.pathname.slice(1)), /(^|[_-])test([_-]|$)/i);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname));
  assert.ok(!['55440', '56379'].includes(database.port));
  const redis = new URL(process.env.REDIS_URL!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(redis.hostname));
  assert.ok(!['55440', '56379'].includes(redis.port));
}

function event(name = 'order.cancelled'): VersionedDomainEvent & { eventId: string } {
  const payload = name === 'order.paid'
    ? { orderId: randomUUID(), orderNumber: `EX044-${randomUUID()}`, customerEmail: null, customerPhone: null }
    : { orderId: randomUUID(), orderNumber: `EX044-${randomUUID()}`, status: 'cancelled', customerEmail: null, customerPhone: null };
  return {
    eventId: randomUUID(), eventName: name as 'order.cancelled', eventVersion: 'v1',
    occurredAt: new Date().toISOString(),
    payload,
  };
}

async function durableEvent(message: VersionedDomainEvent & { eventId: string }, state: 'pending' | 'enqueued' = 'enqueued', eligibility: 'eligible' | 'held' = 'eligible') {
  return prisma.domainEventOutbox.create({ data: {
    eventId: message.eventId, eventName: message.eventName, eventVersion: message.eventVersion,
    payload: message.payload as Prisma.InputJsonValue, occurredAt: new Date(message.occurredAt),
    eligibility, holdReason: eligibility === 'held' ? 'legacy_delivery_requires_reconciliation' : null,
    state, enqueuedAt: state === 'enqueued' ? new Date() : null, nextAttemptAt: new Date(0),
  } });
}

function redisDb15Url(): string {
  const url = new URL(process.env.REDIS_URL!);
  url.pathname = '/15';
  return url.toString();
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

type DisposableRedis =
  | { kind: 'process'; child: ChildProcess }
  | { kind: 'docker'; child: ChildProcess; name: string };

function disposableRedisExited(server: DisposableRedis): boolean {
  return server.child.exitCode !== null;
}

async function stopDisposableRedis(server: DisposableRedis): Promise<void> {
  if (server.child.exitCode !== null) return;
  if (server.kind === 'process') {
    const stopped = new Promise<void>((resolve) => server.child.once('exit', () => resolve()));
    server.child.kill('SIGTERM');
    await stopped;
    return;
  }
  const result = spawnSync('docker', ['stop', '-t', '1', server.name], { stdio: 'ignore' });
  assert.equal(result.status, 0, 'owned disposable Redis container must stop cleanly');
  if (server.child.exitCode === null) {
    await new Promise<void>((resolve) => server.child.once('exit', () => resolve()));
  }
}

async function startDisposableRedis(port: number, dir: string): Promise<DisposableRedis> {
  const forceDocker = process.env.EX044_FORCE_DOCKER_REDIS === 'true';
  const hasRedisServer = !forceDocker && spawnSync('redis-server', ['--version'], { stdio: 'ignore' }).status === 0;
  let server: DisposableRedis;
  if (hasRedisServer) {
    server = {
      kind: 'process',
      child: spawn('redis-server', [
        '--bind', '127.0.0.1', '--port', String(port), '--protected-mode', 'yes', '--save', '',
        '--appendonly', 'no', '--dir', dir, '--loglevel', 'warning',
      ], { stdio: 'ignore' }),
    };
  } else {
    assert.equal(spawnSync('docker', ['version'], { stdio: 'ignore' }).status, 0,
      'redis-server or Docker is required for isolated Redis fault injection');
    const name = `distritools-ex044-${randomUUID()}`;
    server = {
      kind: 'docker',
      name,
      child: spawn('docker', [
        'run', '--rm', '--name', name, '-p', `127.0.0.1:${port}:6379`, 'redis:7-alpine',
        'redis-server', '--protected-mode', 'no', '--save', '', '--appendonly', 'no', '--loglevel', 'warning',
      ], { stdio: 'ignore' }),
    };
  }

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (disposableRedisExited(server)) throw new Error('Disposable Redis exited before readiness');
    const probe = new Redis(`redis://127.0.0.1:${port}`, {
      lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null, connectTimeout: 250,
    });
    probe.on('error', () => undefined);
    try {
      await probe.connect();
      assert.equal(await probe.ping(), 'PONG');
      await probe.quit();
      return server;
    } catch {
      probe.disconnect();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await stopDisposableRedis(server).catch(() => undefined);
  throw new Error('Disposable Redis readiness deadline exceeded');
}

describe('EX-04.4 retry, durable parking and Redis recovery', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let redis: Redis;
  let domainQueue: Queue;
  let notificationQueue: Queue;
  let domainQueueEvents: QueueEvents;
  let registry: DomainEventHandlerRegistry;
  let notificationSubscriber: NotificationsEventSubscriber;
  let notificationPublisher: import('src/infra/events/in-memory-domain-event.publisher').InMemoryDomainEventPublisher;
  let resources: Array<{ queue: Queue; worker?: Worker; events?: QueueEvents; clients: Redis[] }> = [];
  let baseRedisClients: Redis[] = [];

  async function transport(name = `${TEST_PREFIX}-${randomUUID()}`) {
    const url = redisDb15Url();
    const producer = new Redis(url, { ...createProducerRedisOptions(url), lazyConnect: false });
    producer.on('error', () => undefined);
    const workerConnection = new Redis(url, { ...createWorkerRedisOptions(url), lazyConnect: false });
    workerConnection.on('error', () => undefined);
    const queue = new Queue(name, { connection: producer, prefix: TEST_PREFIX });
    queue.on('error', () => undefined);
    const eventsConnection = new Redis(url, { maxRetriesPerRequest: null });
    eventsConnection.on('error', () => undefined);
    const events = new QueueEvents(name, { connection: eventsConnection, prefix: TEST_PREFIX });
    events.on('error', () => undefined);
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
    const entry: (typeof resources)[number] = { queue, events, clients: [producer, workerConnection, eventsConnection] };
    resources.push(entry);
    return { queue, events, workerConnection, entry };
  }

  before(async () => {
    assertIsolatedTargets();
    await resetDatabase();
    seeded = await seedBaseData();
    const url = redisDb15Url();
    redis = new Redis(url, { maxRetriesPerRequest: null });
    baseRedisClients.push(redis);
    redis.on('error', () => undefined);
    await redis.ping();
    const domainProducer = new Redis(url, createProducerRedisOptions(url));
    const notificationProducer = new Redis(url, createProducerRedisOptions(url));
    const domainEventsConnection = new Redis(url, { maxRetriesPerRequest: null });
    baseRedisClients.push(domainProducer, notificationProducer, domainEventsConnection);
    domainQueue = new Queue(`${TEST_PREFIX}-domain`, {
      connection: domainProducer, prefix: TEST_PREFIX,
    });
    domainQueue.on('error', () => undefined);
    notificationQueue = new Queue(NOTIFICATIONS_QUEUE_NAME + `-${TEST_PREFIX}`, {
      connection: notificationProducer, prefix: TEST_PREFIX,
    });
    notificationQueue.on('error', () => undefined);
    domainQueueEvents = new QueueEvents(domainQueue.name, {
      connection: domainEventsConnection, prefix: TEST_PREFIX,
    });
    domainQueueEvents.on('error', () => undefined);
    await Promise.all([domainQueue.waitUntilReady(), notificationQueue.waitUntilReady(), domainQueueEvents.waitUntilReady()]);
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    const notificationRepository = new PrismaNotificationRepository(prisma as never);
    const recovery = new NotificationDispatchRecoveryService(notificationRepository, notificationQueue as never);
    const useCase = new QueueNotificationsFromEventUseCase(new NotificationTemplateService(), inbox, recovery);
    const { InMemoryDomainEventPublisher } = await import('src/infra/events/in-memory-domain-event.publisher');
    notificationPublisher = new InMemoryDomainEventPublisher();
    registry = new DomainEventHandlerRegistry();
    notificationSubscriber = new NotificationsEventSubscriber(notificationPublisher, useCase, registry);
    notificationSubscriber.onModuleInit();
  });

  after(async () => {
    for (const resource of resources.reverse()) {
      await resource.worker?.close(true).catch(() => undefined);
      resource.worker?.disconnect();
      await resource.events?.close().catch(() => undefined);
      resource.events?.disconnect();
      await resource.queue.close().catch(() => undefined);
      resource.queue.disconnect();
      resource.clients.forEach((client) => client.disconnect());
    }
    await domainQueueEvents?.close().catch(() => undefined);
    domainQueueEvents?.disconnect();
    await domainQueue?.close().catch(() => undefined);
    domainQueue?.disconnect();
    await notificationQueue?.close().catch(() => undefined);
    notificationQueue?.disconnect();
    baseRedisClients.forEach((client) => client.disconnect());
    notificationPublisher?.onModuleDestroy();
    await disconnectDatabase();
  });

  it('producer fails within a finite budget when Redis is unavailable before startup', { timeout: 5_000 }, async () => {
    const port = await freePort();
    const url = `redis://127.0.0.1:${port}`;
    const producer = new Redis(url, createProducerRedisOptions(url));
    producer.on('error', () => undefined);
    const publisher = new BullMqDomainEventPublisher({ add: () => producer.set('probe', '1') } as never, 300);
    const message = event();
    const started = Date.now();
    try {
      await assert.rejects(publisher.publish(message));
      assert.ok(Date.now() - started < 1_500);
    } finally {
      producer.disconnect();
    }
  });

  it('parks a real worker retry exhaustion durably, then replays the same failed job once under RBAC', { timeout: 20_000 }, async () => {
    const message = event();
    await durableEvent(message);
    let fail = true;
    const faultedRegistry = new DomainEventHandlerRegistry();
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    const notificationRepository = new PrismaNotificationRepository(prisma as never);
    const recovery = new NotificationDispatchRecoveryService(notificationRepository, notificationQueue as never);
    const useCase = new QueueNotificationsFromEventUseCase(new NotificationTemplateService(), inbox, recovery);
    faultedRegistry.register('order.cancelled', 'notifications.v1', async (input) => {
      if (fail) throw new Error('injected transient consumer failure');
      await useCase.execute(input as never);
    });
    const parking = new PrismaDomainEventParkingRepository(prisma as never);
    const domainWorker = new DomainEventsWorker(faultedRegistry, parking);
    const { queue, events, workerConnection, entry } = await transport();
    const worker = new Worker(queue.name, (job) => domainWorker.process(job), {
      connection: workerConnection, prefix: TEST_PREFIX,
    });
    worker.on('error', () => undefined);
    entry.worker = worker;
    await worker.waitUntilReady();
    const job = await queue.add(message.eventName, message, {
      jobId: message.eventId, attempts: 5,
      backoff: { type: 'exponential', delay: 10, jitter: 0.5 }, removeOnFail: false,
    });
    await assert.rejects(job.waitUntilFinished(events, 8_000));
    const parked = await prisma.domainEventParking.findUniqueOrThrow({
      where: { eventId_consumerKey: { eventId: message.eventId, consumerKey: 'notifications.v1' } },
    });
    assert.equal(parked.failureClass, 'transient');
    assert.equal(parked.errorCategory, 'CONSUMER_RETRY_EXHAUSTED');
    assert.equal(parked.businessAttempts, 5);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId } }), 0);

    const actor = {
      sub: seeded.users.adminUserId, email: seeded.users.adminEmail, role: 'super-admin', sessionId: randomUUID(),
      permissions: ['domain_events.replay'],
    };
    const replayService = new DomainEventReplayService(prisma as never, faultedRegistry, queue);
    assert.equal((await replayService.preview(actor, message.eventId, 'notifications.v1')).dryRun, true);
    const deniedActor = { ...actor, permissions: [] };
    await assert.rejects(replayService.replay(deniedActor, message.eventId, 'notifications.v1'), /Missing required permissions/);

    fail = false;
    const replayOutcomes = await Promise.allSettled([
      replayService.replay(actor, message.eventId, 'notifications.v1'),
      replayService.replay(actor, message.eventId, 'notifications.v1'),
    ]);
    assert.equal(replayOutcomes.filter((result) => result.status === 'fulfilled').length, 1);
    const replayed = await queue.getJob(message.eventId);
    assert.ok(replayed);
    assert.equal(replayed.id, message.eventId);
    await replayed.waitUntilFinished(events, 5_000);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'notifications.v1', status: 'completed' } }), 1);
    assert.equal((await prisma.domainEventParking.findUniqueOrThrow({ where: { eventId_consumerKey: {
      eventId: message.eventId, consumerKey: 'notifications.v1',
    } } })).status, 'resolved');
    assert.equal(await prisma.auditLog.count({ where: { entityId: message.eventId, action: 'domain_event.replay_requested' } }), 1);
  });

  it('does not replay historical held events or consumer-coverage gaps', async () => {
    const held = event();
    await durableEvent(held, 'pending', 'held');
    const heldBefore = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: held.eventId } });
    let heldHandlerCalls = 0;
    const heldRegistry = new DomainEventHandlerRegistry();
    heldRegistry.register('order.cancelled', 'notifications.v1', async () => { heldHandlerCalls += 1; });
    const worker = new DomainEventsWorker(heldRegistry, new PrismaDomainEventParkingRepository(prisma as never));
    await assert.rejects(worker.process({ data: held } as never), /not eligible for delivery/);
    assert.equal(heldHandlerCalls, 0);
    const heldFailure = await prisma.domainEventParking.findUniqueOrThrow({
      where: { eventId_consumerKey: { eventId: held.eventId, consumerKey: 'domain-event-routing.v1' } },
    });
    assert.equal(heldFailure.status, 'parked');
    assert.equal(heldFailure.businessAttempts, 1);
    assert.equal(heldFailure.errorCategory, 'HELD_EVENT_NOT_ELIGIBLE');
    const actor = { sub: seeded.users.adminUserId, email: seeded.users.adminEmail, role: 'super-admin', sessionId: randomUUID(), permissions: ['domain_events.replay'] };
    const service = new DomainEventReplayService(prisma as never, registry, domainQueue);
    const preview = await service.preview(actor, held.eventId, 'domain-event-routing.v1');
    assert.equal(preview.eligible, false);
    assert.equal(preview.reason, 'HISTORICAL_HELD');
    await assert.rejects(service.replay(actor, held.eventId, 'domain-event-routing.v1'), /HISTORICAL_HELD/);
    assert.deepEqual(await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: held.eventId } }), heldBefore);

    const gap = event('order.paid');
    await durableEvent(gap);
    await prisma.domainEventParking.create({ data: {
      id: randomUUID(), eventId: gap.eventId, consumerKey: 'notifications.v1', eventName: gap.eventName,
      failureClass: 'terminal', errorCategory: 'MISSING_REQUIRED_CONSUMER', businessAttempts: 1,
    } });
    await assert.rejects(service.replay(actor, gap.eventId, 'notifications.v1'), /REQUIRED_CONSUMER_GAP/);
  });

  it('reconciles beyond one bounded page without starving later eligible rows or changing held history', async () => {
    const pageTime = new Date('2099-01-01T00:00:00.000Z');
    const messages = Array.from({ length: 53 }, () => event());
    for (const message of messages) {
      await prisma.domainEventOutbox.create({ data: {
        eventId: message.eventId, eventName: message.eventName, eventVersion: message.eventVersion,
        payload: message.payload as Prisma.InputJsonValue, occurredAt: new Date(message.occurredAt),
        eligibility: 'eligible', state: 'enqueued', enqueuedAt: pageTime,
        nextAttemptAt: new Date(0), createdAt: pageTime,
      } });
    }
    const held = event();
    await prisma.domainEventOutbox.create({ data: {
      eventId: held.eventId, eventName: held.eventName, eventVersion: held.eventVersion,
      payload: held.payload as Prisma.InputJsonValue, occurredAt: new Date(held.occurredAt),
      eligibility: 'held', holdReason: 'legacy_delivery_requires_reconciliation', state: 'pending',
      nextAttemptAt: new Date(0), createdAt: pageTime,
    } });
    const heldBefore = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: held.eventId } });
    const reconciler = new DomainEventQueueReconciler(
      new PrismaDomainEventOutboxRepository(prisma as never),
      new PrismaDomainEventInboxRepository(prisma as never), registry, domainQueue,
      new PrismaDomainEventParkingRepository(prisma as never),
    );
    let after: { createdAt: Date; eventId: string } | undefined = { createdAt: new Date('2098-12-31T23:59:59.999Z'), eventId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
    const pageSizes: number[] = [];
    for (let page = 0; page < 5 && after; page += 1) {
      const result = await reconciler.reconcile(50, after);
      pageSizes.push(result.examined);
      const [timestamp, eventId] = result.nextCursor?.split('|') ?? [];
      after = result.nextCursor ? { createdAt: new Date(timestamp!), eventId: eventId! } : undefined;
    }
    assert.deepEqual(pageSizes, [50, 3]);
    for (const message of messages) {
      const queued = await domainQueue.getJob(message.eventId);
      assert.ok(queued, `expected stable job for event ${message.eventId}`);
      assert.equal(queued.id, message.eventId);
    }
    assert.deepEqual(await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: held.eventId } }), heldBefore);
  });

  it('parks unsupported or unimplemented consumers without ACK and fences stale outbox claims', async () => {
    const unsupported = event();
    await durableEvent(unsupported);
    const noHandlerWorker = new DomainEventsWorker(new DomainEventHandlerRegistry(), new PrismaDomainEventParkingRepository(prisma as never));
    await assert.rejects(noHandlerWorker.process({ data: unsupported, attemptsMade: 0 } as never));
    const terminal = await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: unsupported.eventId, consumerKey: 'domain-event-routing.v1' },
    } });
    assert.equal(terminal.status, 'parked');
    assert.equal(terminal.errorCategory, 'MISSING_REQUIRED_CONSUMER');

    const stale = event();
    await durableEvent(stale, 'pending');
    const repository = new PrismaDomainEventOutboxRepository(prisma as never);
    const firstClaim = await repository.claimEligible(1, 5_000);
    assert.equal(firstClaim[0]?.eventId, stale.eventId);
    await prisma.$executeRaw`UPDATE domain_event_outbox SET lease_until = clock_timestamp() - interval '1 second' WHERE event_id = ${stale.eventId}::uuid`;
    const secondClaim = await repository.claimEligible(1, 5_000);
    assert.equal(secondClaim[0]?.eventId, stale.eventId);
    assert.notEqual(secondClaim[0]?.claimToken, firstClaim[0]?.claimToken);
    assert.equal(await repository.parkTerminal(stale.eventId, firstClaim[0]!.claimToken, 'INVALID_ENVELOPE'), false);
    assert.equal(await prisma.domainEventParking.count({ where: { eventId: stale.eventId } }), 0);
    assert.equal(await repository.parkTerminal(stale.eventId, secondClaim[0]!.claimToken, 'INVALID_ENVELOPE'), true);
    assert.equal(await prisma.domainEventParking.count({ where: { eventId: stale.eventId } }), 1);
  });

  it('keeps the five-attempt business budget in PostgreSQL across job recreation and excludes Redis outages', async () => {
    const message = event();
    await durableEvent(message);
    let calls = 0;
    const deliveryRegistry = new DomainEventHandlerRegistry();
    deliveryRegistry.register('order.cancelled', 'notifications.v1', async () => {
      calls += 1;
      throw new Error('transient consumer failure');
    });
    const parkingRepository = new PrismaDomainEventParkingRepository(prisma as never);
    const worker = new DomainEventsWorker(deliveryRegistry, parkingRepository);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await assert.rejects(worker.process({ data: message, attemptsMade: 0 } as never), /transient consumer failure/);
    }
    assert.equal((await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: message.eventId, consumerKey: 'notifications.v1' },
    } })).businessAttempts, 4);

    Object.defineProperty(worker, 'worker', { value: { client: { status: 'reconnecting' } }, configurable: true });
    await assert.rejects(worker.process({ data: message, attemptsMade: 0 } as never), /queue Redis is unavailable/);
    assert.equal((await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: message.eventId, consumerKey: 'notifications.v1' },
    } })).businessAttempts, 4);

    Object.defineProperty(worker, 'worker', { value: { client: { status: 'ready' } }, configurable: true });
    await assert.rejects(worker.process({ data: message, attemptsMade: 0 } as never), /parked after bounded business retries/);
    const parked = await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: message.eventId, consumerKey: 'notifications.v1' },
    } });
    assert.equal(calls, 6);
    assert.equal(parked.status, 'parked');
    assert.equal(parked.businessAttempts, 5);
  });

  it('does not spend consumer retry budget on a real worker Redis outage during dispatch', { timeout: 15_000 }, async () => {
    const port = await freePort();
    const dir = mkdtempSync(path.join(tmpdir(), 'ex044-active-worker-outage-'));
    let server: DisposableRedis | undefined;
    let producer: Queue | undefined;
    let worker: Worker | undefined;
    let events: QueueEvents | undefined;
    let workerConnection: Redis | undefined;
    let eventConnection: Redis | undefined;
    let producerConnection: Redis | undefined;
    let callsDuringOutage = 0;
    let resolveStarted!: () => void;
    let resolveInterrupted!: () => void;
    let resolveProcessFinished!: () => void;
    let rejectHandler!: (error: Error) => void;
    const started = new Promise<void>((resolve) => { resolveStarted = resolve; });
    const interrupted = new Promise<void>((resolve) => { resolveInterrupted = resolve; });
    const processFinished = new Promise<void>((resolve) => { resolveProcessFinished = resolve; });
    const outage = new Promise<never>((_, reject) => { rejectHandler = reject; });
    let failDuringOutage = true;
    try {
      server = await startDisposableRedis(port, dir);
      const url = `redis://127.0.0.1:${port}`;
      producerConnection = new Redis(url, createProducerRedisOptions(url));
      producerConnection.on('error', () => undefined);
      producer = new Queue(`${TEST_PREFIX}-active-outage`, { connection: producerConnection, prefix: TEST_PREFIX });
      producer.on('error', () => undefined);
      eventConnection = new Redis(url, { maxRetriesPerRequest: null });
      eventConnection.on('error', () => undefined);
      events = new QueueEvents(producer.name, { connection: eventConnection, prefix: TEST_PREFIX });
      events.on('error', () => undefined);
      await Promise.all([producer.waitUntilReady(), events.waitUntilReady()]);

      const message = event();
      await durableEvent(message);
      const inbox = new PrismaDomainEventInboxRepository(prisma as never);
      const registry = new DomainEventHandlerRegistry();
      registry.register('order.cancelled', 'notifications.v1', async (input) => {
        callsDuringOutage += 1;
        if (failDuringOutage) {
          resolveStarted();
          try { await outage; }
          catch (error) { resolveInterrupted(); throw error; }
        }
        await inbox.runOnce('notifications.v1', input, async () => undefined);
      });
      const parking = new PrismaDomainEventParkingRepository(prisma as never);
      const domainWorker = new DomainEventsWorker(registry, parking);
      workerConnection = new Redis(url, createWorkerRedisOptions(url));
      workerConnection.on('error', () => undefined);
      worker = new Worker(producer.name, async (job) => {
        try { await domainWorker.process(job); }
        finally { resolveProcessFinished(); }
      }, {
        connection: workerConnection, prefix: TEST_PREFIX, concurrency: 1,
      });
      worker.on('error', () => undefined);
      Object.defineProperty(domainWorker, 'worker', { value: worker });
      await worker.waitUntilReady();
      await producer.add(message.eventName, message, {
        jobId: message.eventId, attempts: 1, backoff: { type: 'exponential', delay: 25 }, removeOnFail: false,
      });
      await started;
      await stopDisposableRedis(server!);
      const disconnectDeadline = Date.now() + 2_000;
      while (Date.now() < disconnectDeadline && workerConnection.status === 'ready') await new Promise((resolve) => setTimeout(resolve, 20));
      assert.notEqual(workerConnection.status, 'ready');
      rejectHandler(new Error('consumer interrupted after Redis loss'));
      await interrupted;
      await processFinished;
      assert.equal(callsDuringOutage, 1, 'one broker claim is interrupted by this injected outage');
      assert.equal(await prisma.domainEventParking.count({ where: { eventId: message.eventId } }), 0,
        'Redis disconnect during processing is not parked as a consumer failure');
      assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId } }), 0);

      server = await startDisposableRedis(port, dir);
      await worker.close(true).catch(() => undefined);
      worker.disconnect();
      worker = undefined;
      await producer.close().catch(() => undefined);
      producer.disconnect();
      producerConnection.disconnect();
      producerConnection = new Redis(url, createProducerRedisOptions(url));
      producerConnection.on('error', () => undefined);
      producer = new Queue(`${TEST_PREFIX}-active-outage`, { connection: producerConnection, prefix: TEST_PREFIX });
      producer.on('error', () => undefined);
      await producer.waitUntilReady();
      await events.close().catch(() => undefined);
      events.disconnect();
      eventConnection.disconnect();
      eventConnection = new Redis(url, { maxRetriesPerRequest: null });
      eventConnection.on('error', () => undefined);
      events = new QueueEvents(producer.name, { connection: eventConnection, prefix: TEST_PREFIX });
      events.on('error', () => undefined);
      await events.waitUntilReady();

      failDuringOutage = false;
      workerConnection = new Redis(url, createWorkerRedisOptions(url));
      workerConnection.on('error', () => undefined);
      const recoveredWorkerDomain = new DomainEventsWorker(registry, parking);
      worker = new Worker(producer.name, (job) => recoveredWorkerDomain.process(job), {
        connection: workerConnection, prefix: TEST_PREFIX, concurrency: 1,
      });
      worker.on('error', () => undefined);
      Object.defineProperty(recoveredWorkerDomain, 'worker', { value: worker });
      await worker.waitUntilReady();
      const reconciler = new DomainEventQueueReconciler(
        new PrismaDomainEventOutboxRepository(prisma as never), inbox, registry, producer,
        parking,
      );
      const repaired = await reconciler.reconcile(50);
      assert.ok(repaired.enqueued >= 1);
      const rebuilt = await producer.getJob(message.eventId);
      assert.ok(rebuilt);
      assert.equal(rebuilt.id, message.eventId);
      await rebuilt.waitUntilFinished(events, 4_000);
      assert.equal(await prisma.domainEventInbox.count({ where: {
        eventId: message.eventId, consumerKey: 'notifications.v1', status: 'completed',
      } }), 1);
      assert.equal(await prisma.domainEventParking.count({ where: { eventId: message.eventId } }), 0);
    } finally {
      if (worker) {
        const workerResult = await boundedWorkerShutdown(worker as never, 250);
        if (!workerResult.drained) await worker.close(true).catch(() => undefined);
        worker.disconnect();
      }
      await events?.close().catch(() => undefined);
      events?.disconnect();
      await producer?.close().catch(() => undefined);
      producer?.disconnect();
      workerConnection?.disconnect();
      eventConnection?.disconnect();
      producerConnection?.disconnect();
      if (server && !disposableRedisExited(server)) {
        await stopDisposableRedis(server);
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reconstructs only pending consumers after queue data loss; completed inbox and sent/uncertain notifications remain guarded', async () => {
    const pending = event();
    await durableEvent(pending);
    const reconciler = new DomainEventQueueReconciler(
      new PrismaDomainEventOutboxRepository(prisma as never),
      new PrismaDomainEventInboxRepository(prisma as never), registry, domainQueue,
      new PrismaDomainEventParkingRepository(prisma as never),
    );
    await domainQueue.obliterate({ force: true });
    const result = await reconciler.reconcile(50);
    assert.ok(result.enqueued >= 1);
    let recreated = await domainQueue.getJob(pending.eventId);
    assert.ok(recreated);
    assert.equal(recreated.id, pending.eventId);
    await recreated.remove(); // Simulated queue data loss; PostgreSQL intent and inbox remain.
    const again = await reconciler.reconcile(50);
    assert.ok(again.enqueued >= 1);
    recreated = await domainQueue.getJob(pending.eventId);
    assert.ok(recreated);
    assert.equal(recreated.id, pending.eventId);

    const completed = event();
    await durableEvent(completed);
    await registry.dispatch(completed);
    const completedReceipt = await prisma.domainEventInbox.findUniqueOrThrow({ where: {
      consumerKey_eventId: { consumerKey: 'notifications.v1', eventId: completed.eventId },
    } });
    assert.equal(completedReceipt.status, 'completed');
    await domainQueue.obliterate({ force: true });
    const completionRecovery = await reconciler.reconcile(50);
    assert.ok(completionRecovery.completed >= 1);
    assert.equal(await domainQueue.getJob(completed.eventId), undefined);
    assert.equal(await prisma.domainEventInbox.count({ where: { consumerKey: 'notifications.v1', eventId: completed.eventId } }), 1);

    const missingReceipt = event();
    await durableEvent(missingReceipt);
    const workerConnection = new Redis(redisDb15Url(), createWorkerRedisOptions(redisDb15Url()));
    workerConnection.on('error', () => undefined);
    const completedWorker = new Worker(domainQueue.name, async () => 'bull-completed-without-pg-receipt', {
      connection: workerConnection, prefix: TEST_PREFIX,
    });
    completedWorker.on('error', () => undefined);
    await completedWorker.waitUntilReady();
    const missingReceiptJob = await domainQueue.add(missingReceipt.eventName, missingReceipt, {
      jobId: missingReceipt.eventId, attempts: 1, removeOnFail: false,
    });
    await missingReceiptJob.waitUntilFinished(domainQueueEvents, 2_000);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: missingReceipt.eventId } }), 0);
    await completedWorker.close(true);
    workerConnection.disconnect();
    await prisma.domainEventParking.create({ data: {
      id: randomUUID(), eventId: missingReceipt.eventId, consumerKey: 'notifications.v1', eventName: missingReceipt.eventName,
      failureClass: 'ambiguous', errorCategory: 'CONSUMER_OUTCOME_UNCERTAIN', businessAttempts: 1,
    } });
    const reconstructed = await reconciler.reconcile(50);
    assert.ok(reconstructed.retained >= 1, 'a parked delivery waits for explicit authorized replay');
    const completedButUnreceipted = await domainQueue.getJob(missingReceipt.eventId);
    assert.equal(await completedButUnreceipted?.getState(), 'completed');

    const replayTransport = await transport(domainQueue.name);
    const recoveryWorker = new DomainEventsWorker(registry, new PrismaDomainEventParkingRepository(prisma as never));
    const replayWorker = new Worker(replayTransport.queue.name, (job) => recoveryWorker.process(job), {
      connection: replayTransport.workerConnection, prefix: TEST_PREFIX,
    });
    replayWorker.on('error', () => undefined);
    replayTransport.entry.worker = replayWorker;
    await replayWorker.waitUntilReady();
    const replayActor = {
      sub: seeded.users.adminUserId, email: seeded.users.adminEmail, role: 'super-admin', sessionId: randomUUID(),
      permissions: ['domain_events.replay'],
    };
    const replayService = new DomainEventReplayService(prisma as never, registry, replayTransport.queue);
    const replayResult = await replayService.replay(replayActor, missingReceipt.eventId, 'notifications.v1');
    assert.equal(replayResult.queueAction, 'recreated');
    const replayedMissingReceipt = await replayTransport.queue.getJob(missingReceipt.eventId);
    assert.ok(replayedMissingReceipt);
    await replayedMissingReceipt.waitUntilFinished(replayTransport.events, 5_000);
    assert.equal(await prisma.domainEventInbox.count({ where: {
      eventId: missingReceipt.eventId, consumerKey: 'notifications.v1', status: 'completed',
    } }), 1);
    assert.equal((await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: missingReceipt.eventId, consumerKey: 'notifications.v1' },
    } })).status, 'resolved');
    await replayWorker.close(true);
    replayTransport.entry.worker = undefined;
    replayTransport.workerConnection.disconnect();

    const exhausted = event();
    await durableEvent(exhausted);
    const failingConnection = new Redis(redisDb15Url(), createWorkerRedisOptions(redisDb15Url()));
    failingConnection.on('error', () => undefined);
    const exhaustedWorker = new Worker(domainQueue.name, async () => { throw new Error('injected worker crash before PG parking'); }, {
      connection: failingConnection, prefix: TEST_PREFIX,
    });
    exhaustedWorker.on('error', () => undefined);
    await exhaustedWorker.waitUntilReady();
    const exhaustedJob = await domainQueue.add(exhausted.eventName, exhausted, {
      jobId: exhausted.eventId, attempts: 1, removeOnFail: false,
    });
    await assert.rejects(exhaustedJob.waitUntilFinished(domainQueueEvents, 2_000));
    await exhaustedWorker.close(true);
    failingConnection.disconnect();
    const failureReconciliation = await reconciler.reconcile(50);
    assert.ok(failureReconciliation.parked >= 1);
    const crashRecoveredJob = await domainQueue.getJob(exhausted.eventId);
    assert.ok(crashRecoveredJob, 'failed queue evidence is retained after durable parking');
    assert.equal(await crashRecoveredJob.getState(), 'failed');
    const crashWindowParking = await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: exhausted.eventId, consumerKey: 'domain-event-routing.v1' },
    } });
    assert.equal(crashWindowParking.status, 'parked');
    assert.equal(crashWindowParking.errorCategory, 'CONSUMER_OUTCOME_UNCERTAIN');

    for (const status of ['sent', 'uncertain'] as const) {
      const notificationId = randomUUID();
      await prisma.notification.create({ data: {
        id: notificationId, eventId: randomUUID(), eventName: `synthetic.${status}`,
        channel: 'internal', recipient: 'redacted-test', content: 'test', provider: 'local-test',
        status, dispatchEligible: true,
      } });
    }
    const notificationRepository = new PrismaNotificationRepository(prisma as never);
    const notificationRecovery = new NotificationDispatchRecoveryService(notificationRepository, notificationQueue as never);
    await notificationRecovery.recoverBatch();
    assert.equal(await prisma.notification.count({ where: { status: 'sent', eventName: 'synthetic.sent' } }), 1);
    assert.equal(await prisma.notification.count({ where: { status: 'uncertain', eventName: 'synthetic.uncertain' } }), 1);
  });

  it('does not reset or replace a failed queue job while an operator replay lease is active', async () => {
    const message = event();
    const createdAt = new Date('2100-01-01T00:00:00.000Z');
    await prisma.domainEventOutbox.create({ data: {
      eventId: message.eventId, eventName: message.eventName, eventVersion: message.eventVersion,
      payload: message.payload as Prisma.InputJsonValue, occurredAt: new Date(message.occurredAt),
      eligibility: 'eligible', state: 'enqueued', enqueuedAt: createdAt, nextAttemptAt: new Date(0), createdAt,
    } });
    const job = await domainQueue.add(message.eventName, message, { jobId: message.eventId, attempts: 1, removeOnFail: false });
    const failingWorkerConnection = new Redis(redisDb15Url(), createWorkerRedisOptions(redisDb15Url()));
    failingWorkerConnection.on('error', () => undefined);
    const failingWorker = new Worker(domainQueue.name, async () => { throw new Error('replay attempt failed'); }, {
      connection: failingWorkerConnection, prefix: TEST_PREFIX,
    });
    failingWorker.on('error', () => undefined);
    await failingWorker.waitUntilReady();
    await assert.rejects(job.waitUntilFinished(domainQueueEvents, 2_000));
    await failingWorker.close(true);
    failingWorkerConnection.disconnect();

    const replayToken = randomUUID();
    await prisma.domainEventParking.create({ data: {
      id: randomUUID(), eventId: message.eventId, consumerKey: 'notifications.v1', eventName: message.eventName,
      failureClass: 'transient', errorCategory: 'CONSUMER_RETRYABLE_FAILURE', businessAttempts: 5,
      replayAttemptBaseline: 0, status: 'parked', replayCount: 1,
      replayClaimToken: replayToken, replayLeaseUntil: new Date(Date.now() + 30_000), lastReplayById: seeded.users.adminUserId,
    } });
    const before = await domainQueue.getJob(message.eventId);
    assert.ok(before);
    const attemptsBefore = before.attemptsMade;
    const reconciler = new DomainEventQueueReconciler(
      new PrismaDomainEventOutboxRepository(prisma as never),
      new PrismaDomainEventInboxRepository(prisma as never), registry, domainQueue,
      new PrismaDomainEventParkingRepository(prisma as never),
    );
    const actor = {
      sub: seeded.users.adminUserId, email: seeded.users.adminEmail, role: 'super-admin', sessionId: randomUUID(),
      permissions: ['domain_events.replay'],
    };
    const replayService = new DomainEventReplayService(prisma as never, registry, domainQueue);
    assert.equal((await replayService.preview(actor, message.eventId, 'notifications.v1')).eligible, false);
    await assert.rejects(replayService.replay(actor, message.eventId, 'notifications.v1'), /already accepted or in progress/);
    const result = await reconciler.reconcile(50, {
      createdAt: new Date('2099-12-31T23:59:59.999Z'), eventId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    });
    assert.ok(result.retained >= 1);
    const after = await domainQueue.getJob(message.eventId);
    assert.ok(after);
    assert.equal(after.id, message.eventId);
    assert.equal(await after.getState(), 'failed');
    assert.equal(after.attemptsMade, attemptsBefore);
    assert.equal((await prisma.domainEventParking.findUniqueOrThrow({ where: {
      eventId_consumerKey: { eventId: message.eventId, consumerKey: 'notifications.v1' },
    } })).replayClaimToken, replayToken);
  });

  it('drains active real worker work on shutdown and stops claiming queued work until restart', { timeout: 10_000 }, async () => {
    const first = event();
    const second = event();
    await durableEvent(first);
    await durableEvent(second);
    const { queue, events, workerConnection, entry } = await transport();
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    let resolveStarted!: () => void;
    let releaseFirst!: () => void;
    const started = new Promise<void>((resolve) => { resolveStarted = resolve; });
    const firstBarrier = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const registry = new DomainEventHandlerRegistry();
    registry.register('order.cancelled', 'notifications.v1', async (input) => {
      if (input.eventId === first.eventId) {
        resolveStarted();
        await firstBarrier;
      }
      await inbox.runOnce('notifications.v1', input, async () => undefined);
    });
    const domainWorker = new DomainEventsWorker(registry, new PrismaDomainEventParkingRepository(prisma as never));
    const worker = new Worker(queue.name, (job) => domainWorker.process(job), {
      connection: workerConnection, prefix: TEST_PREFIX, concurrency: 1,
    });
    worker.on('error', () => undefined);
    entry.worker = worker;
    Object.defineProperty(domainWorker, 'worker', { value: worker });
    await worker.waitUntilReady();
    await queue.add(first.eventName, first, { jobId: first.eventId, attempts: 1 });
    await started;
    const queuedSecond = await queue.add(second.eventName, second, { jobId: second.eventId, attempts: 1 });
    const drain = boundedWorkerShutdown(worker, 2_000);
    releaseFirst();
    assert.deepEqual(await drain, { drained: true });
    assert.equal(await prisma.domainEventInbox.count({ where: {
      eventId: first.eventId, consumerKey: 'notifications.v1', status: 'completed',
    } }), 1);
    assert.equal(await queue.getJob(second.eventId).then((job) => job?.getState()), 'waiting');
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: second.eventId } }), 0);

    const restartedConnection = new Redis(redisDb15Url(), createWorkerRedisOptions(redisDb15Url()));
    restartedConnection.on('error', () => undefined);
    const restartedDomainWorker = new DomainEventsWorker(registry, new PrismaDomainEventParkingRepository(prisma as never));
    const restartedWorker = new Worker(queue.name, (job) => restartedDomainWorker.process(job), {
      connection: restartedConnection, prefix: TEST_PREFIX, concurrency: 1,
    });
    restartedWorker.on('error', () => undefined);
    entry.clients.push(restartedConnection);
    entry.worker = restartedWorker;
    Object.defineProperty(restartedDomainWorker, 'worker', { value: restartedWorker });
    await restartedWorker.waitUntilReady();
    await queuedSecond.waitUntilFinished(events, 3_000);
    assert.equal(await prisma.domainEventInbox.count({ where: {
      eventId: second.eventId, consumerKey: 'notifications.v1', status: 'completed',
    } }), 1);
  });

  it('recreates the same outbox job after a real isolated Redis process outage and recreation', { timeout: 15_000 }, async () => {
    const port = await freePort();
    const dir = mkdtempSync(path.join(tmpdir(), 'ex044-redis-fault-'));
    let server: DisposableRedis | undefined;
    let queue: Queue | undefined;
    try {
      server = await startDisposableRedis(port, dir);
      const url = `redis://127.0.0.1:${port}`;
      queue = new Queue(`${TEST_PREFIX}-fault-child`, { connection: createProducerRedisOptions(url), prefix: TEST_PREFIX });
      queue.on('error', () => undefined);
      await queue.waitUntilReady();
      const message = event();
      const row = await durableEvent(message, 'pending');
      await stopDisposableRedis(server!);
      const publisher = new BullMqDomainEventPublisher(queue, 400);
      const repository = new PrismaDomainEventOutboxRepository(prisma as never);
      const failed = await new DomainEventOutboxRelay(repository, publisher).runIsolatedBatch({ batchSize: 1, leaseMs: 5_000 });
      assert.equal(failed.failed, 1);
      const pendingRow = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { eventId: message.eventId } });
      assert.equal(pendingRow.eventId, row.eventId);
      assert.equal(pendingRow.state, 'pending');
      assert.equal(pendingRow.enqueuedAt, null);
      assert.equal(await prisma.domainEventParking.count({ where: { eventId: message.eventId } }), 0,
        'global Redis outage must defer infrastructure work without consuming a consumer business attempt');

      server = await startDisposableRedis(port, dir); // no persistence: a fresh empty Redis process
      await queue.close().catch(() => undefined);
      queue = new Queue(`${TEST_PREFIX}-fault-child`, { connection: createProducerRedisOptions(url), prefix: TEST_PREFIX });
      queue.on('error', () => undefined);
      await queue.waitUntilReady();
      await prisma.domainEventOutbox.update({ where: { eventId: message.eventId }, data: { nextAttemptAt: new Date(0) } });
      const recovered = await new DomainEventOutboxRelay(repository, new BullMqDomainEventPublisher(queue, 400))
        .runIsolatedBatch({ batchSize: 1, leaseMs: 5_000 });
      assert.equal(recovered.enqueued, 1);
      const job = await queue.getJob(message.eventId);
      assert.ok(job);
      assert.equal(job.id, row.eventId);
      assert.equal(job.data.eventId, row.eventId);
    } finally {
      if (server && !disposableRedisExited(server)) {
        await stopDisposableRedis(server);
      }
      await queue?.obliterate({ force: true }).catch(() => undefined);
      await queue?.close().catch(() => undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('worker reconnects after Redis loss without retry stampede and processes new recoverable work', { timeout: 15_000 }, async () => {
    const port = await freePort();
    const dir = mkdtempSync(path.join(tmpdir(), 'ex044-worker-reconnect-'));
    const url = `redis://127.0.0.1:${port}`;
    const name = `${TEST_PREFIX}-worker-reconnect`;
    let server: DisposableRedis | undefined;
    let worker: Worker | undefined;
    let producer: Queue | undefined;
    let events: QueueEvents | undefined;
    const clients: Redis[] = [];
    try {
      server = await startDisposableRedis(port, dir);
      const workerConnection = new Redis(url, createWorkerRedisOptions(url));
      workerConnection.on('error', () => undefined);
      clients.push(workerConnection);
      worker = new Worker(name, async (job) => job.data.value, { connection: workerConnection, prefix: TEST_PREFIX });
      worker.on('error', () => undefined);
      await worker.waitUntilReady();
      const workerClient = await worker.client;

      const oldProducerConnection = new Redis(url, createProducerRedisOptions(url));
      oldProducerConnection.on('error', () => undefined);
      clients.push(oldProducerConnection);
      producer = new Queue(name, { connection: oldProducerConnection, prefix: TEST_PREFIX });
      producer.on('error', () => undefined);
      const eventsConnection = new Redis(url, { maxRetriesPerRequest: null });
      eventsConnection.on('error', () => undefined);
      clients.push(eventsConnection);
      events = new QueueEvents(name, { connection: eventsConnection, prefix: TEST_PREFIX });
      events.on('error', () => undefined);
      await Promise.all([producer.waitUntilReady(), events.waitUntilReady()]);
      const first = await producer.add('probe', { value: 'before-outage' });
      assert.equal(await first.waitUntilFinished(events, 2_000), 'before-outage');

      await stopDisposableRedis(server!);
      const outageDeadline = Date.now() + 2_000;
      while (Date.now() < outageDeadline && workerClient.status === 'ready') await new Promise((resolve) => setTimeout(resolve, 20));
      assert.notEqual(workerClient.status, 'ready', 'worker must observe Redis loss after readiness');

      server = await startDisposableRedis(port, dir);
      const reconnectDeadline = Date.now() + 5_000;
      while (Date.now() < reconnectDeadline && workerClient.status !== 'ready') await new Promise((resolve) => setTimeout(resolve, 25));
      assert.equal(workerClient.status, 'ready', 'worker connection should reconnect with persistent policy');

      await producer.close().catch(() => undefined);
      oldProducerConnection.disconnect();
      const newProducerConnection = new Redis(url, createProducerRedisOptions(url));
      newProducerConnection.on('error', () => undefined);
      clients.push(newProducerConnection);
      producer = new Queue(name, { connection: newProducerConnection, prefix: TEST_PREFIX });
      producer.on('error', () => undefined);
      await producer.waitUntilReady();
      await events.close();
      const newEventsConnection = new Redis(url, { maxRetriesPerRequest: null });
      newEventsConnection.on('error', () => undefined);
      clients.push(newEventsConnection);
      events = new QueueEvents(name, { connection: newEventsConnection, prefix: TEST_PREFIX });
      events.on('error', () => undefined);
      await events.waitUntilReady();
      const recovered = await producer.add('probe', { value: 'after-reconnect' });
      assert.equal(await recovered.waitUntilFinished(events, 3_000), 'after-reconnect');
    } finally {
      await worker?.close(true).catch(() => undefined);
      worker?.disconnect();
      await events?.close().catch(() => undefined);
      events?.disconnect();
      await producer?.close().catch(() => undefined);
      producer?.disconnect();
      clients.forEach((client) => client.disconnect());
      if (server && !disposableRedisExited(server)) {
        await stopDisposableRedis(server);
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
