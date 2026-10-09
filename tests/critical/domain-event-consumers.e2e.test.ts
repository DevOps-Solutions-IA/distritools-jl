import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it, mock } from 'node:test';
import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { NotificationChannel, PrismaClient } from '@prisma/client';
import { disconnectDatabase, prisma, resetDatabase } from 'tests/helpers/test-db';
import { DomainEvent, VersionedDomainEvent } from 'src/common/events/domain-event.publisher';
import { NotificationTemplateService } from 'src/modules/notifications/domain/services/notification-template.service';
import { PrismaNotificationRepository } from 'src/modules/notifications/infrastructure/repositories/prisma-notification.repository';
import { NotificationDispatchRecoveryService } from 'src/modules/notifications/infrastructure/queue/notification-dispatch-recovery.service';
import { QueueNotificationsFromEventUseCase } from 'src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case';
import { NotificationsEventSubscriber } from 'src/modules/notifications/infrastructure/queue/notifications-event.subscriber';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { MissingDomainEventHandlerError } from 'src/infra/events/domain-event-handler.registry';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';
import { PrismaDomainEventParkingRepository } from 'src/infra/events/prisma-domain-event-parking.repository';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { SearchEventSubscriber } from 'src/modules/search/infrastructure/jobs/search-event.subscriber';
import { ReindexContentUseCase } from 'src/modules/search/application/use-cases/reindex-content.use-case';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';
import { PrismaSearchRepository } from 'src/modules/search/infrastructure/repositories/prisma-search.repository';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function waitBarrier(gate: ReturnType<typeof barrier>, operation: Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      gate.promise,
      operation.then(() => { throw new Error('Operation finished before expected barrier'); }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Barrier deadline exceeded')), 4000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

function isolatedTargets() {
  assert.equal(process.env.CI, 'true');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.APP_ENV, 'test');
  const db = new URL(process.env.DATABASE_URL!);
  assert.ok(['postgres:', 'postgresql:'].includes(db.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname));
  assert.ok(!['55440', '56379'].includes(db.port));
  assert.match(decodeURIComponent(db.pathname.slice(1)), /(^|[_-])test([_-]|$)/i);
  const redis = new URL(process.env.REDIS_URL!);
  assert.equal(redis.protocol, 'redis:');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(redis.hostname));
  assert.ok(!['55440', '56379'].includes(redis.port));
}

function event(name: 'order.created' | 'content.published', payload: Record<string, unknown>): VersionedDomainEvent & { eventId: string } {
  return { eventId: randomUUID(), eventName: name, eventVersion: 'v1', occurredAt: new Date().toISOString(), payload } as never;
}

async function persistEligibleIntent(message: VersionedDomainEvent & { eventId: string }): Promise<void> {
  await prisma.domainEventOutbox.create({ data: {
    eventId: message.eventId, eventName: message.eventName, eventVersion: message.eventVersion,
    payload: message.payload as never, occurredAt: new Date(message.occurredAt),
    eligibility: 'eligible', state: 'enqueued', enqueuedAt: new Date(), nextAttemptAt: new Date(0),
    routingDecision: { create: { route: 'durable', reason: 'TEST_ONLY_DURABLE', policyVersion: 'ex045.v1' } },
  } });
}

async function waitFor<T>(read: () => Promise<T | null>, message: string): Promise<T> {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    const value = await read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

describe('EX-04.3 real registered consumers over isolated BullMQ', () => {
  const token = randomUUID().replaceAll('-', '');
  const eventQueueName = `ex043-events-${token}`;
  const notificationQueueName = `ex043-notifications-${token}`;
  let redis: Redis;
  let eventQueue: Queue;
  let notificationQueue: Queue;
  let events: QueueEvents;
  let worker: Worker;
  const connections: Redis[] = [];
  let publisher: InMemoryDomainEventPublisher;
  let registry: DomainEventHandlerRegistry;
  let notificationSubscriber: NotificationsEventSubscriber;
  let searchSubscriber: SearchEventSubscriber;
  let sharedInbox: PrismaDomainEventInboxRepository;

  before(async () => {
    isolatedTargets();
    await resetDatabase();
    redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const duplicate = () => {
      const connection = redis.duplicate({ maxRetriesPerRequest: null });
      connections.push(connection);
      return connection;
    };
    const workerConnection = duplicate();
    eventQueue = new Queue(eventQueueName, { connection: duplicate() });
    notificationQueue = new Queue(notificationQueueName, { connection: duplicate() });
    events = new QueueEvents(eventQueueName, { connection: duplicate() });
    await Promise.all([eventQueue.waitUntilReady(), notificationQueue.waitUntilReady(), events.waitUntilReady()]);
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    sharedInbox = inbox;
    const notificationRepository = new PrismaNotificationRepository(prisma as never);
    const recovery = new NotificationDispatchRecoveryService(notificationRepository, notificationQueue as never);
    const notifications = new QueueNotificationsFromEventUseCase(new NotificationTemplateService(), inbox, recovery);
    publisher = new InMemoryDomainEventPublisher();
    registry = new DomainEventHandlerRegistry();
    notificationSubscriber = new NotificationsEventSubscriber(publisher, notifications, registry);
    notificationSubscriber.onModuleInit();

    const searchRepository = new PrismaSearchRepository(prisma as never);
    const searchContent = new ReindexContentUseCase(prisma as never, searchRepository);
    const searchVariants = new ReindexVariantsUseCase(prisma as never, searchRepository);
    searchSubscriber = new SearchEventSubscriber(publisher, searchContent, searchVariants, registry, inbox);
    searchSubscriber.onModuleInit();

    const domainWorker = new DomainEventsWorker(registry, new PrismaDomainEventParkingRepository(prisma as never));
    worker = new Worker(eventQueueName, (job) => domainWorker.process(job), { connection: workerConnection });
    await worker.waitUntilReady();
  });

  after(async () => {
    await Promise.allSettled([worker?.close(), events?.close(), eventQueue?.close(), notificationQueue?.close(), redis?.quit()]);
    for (const connection of connections) connection.disconnect();
    publisher?.onModuleDestroy();
    await disconnectDatabase();
  });

  it('shares one notification effect between durable worker and legacy publisher; queue retry keeps original IDs', async () => {
    const message = event('order.created', {
      orderId: randomUUID(), orderNumber: `EX043-${token}`, trackingCode: 'TRACK-TEST', status: 'pending',
      totals: { subtotal: '10', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '10' },
      customerEmail: `customer-${token}@example.test`, customerPhone: null,
      items: [{ sku: 'SKU-EX043', name: 'Synthetic item', quantity: 1, unitPrice: '10', lineTotal: '10' }],
    });
    await persistEligibleIntent(message);
    const job = await eventQueue.add(message.eventName, message, { jobId: message.eventId });
    await Promise.all([job.waitUntilFinished(events, 5000), publisher.publish(message)]);

    assert.equal(await prisma.notification.count({ where: { eventId: message.eventId } }), 2);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'notifications.v1', status: 'completed' } }), 1);
    const jobs = await notificationQueue.getWaiting();
    assert.equal(jobs.length, 2);
    const notificationIds = jobs.map((pending) => String(pending.data.notificationId)).sort();
    assert.deepEqual(jobs.map((pending) => pending.id).sort(), notificationIds);
  });

  it('overlaps durable and legacy notification handlers behind a barrier with one logical queued audit', async () => {
    const entered = barrier();
    const competitor = barrier();
    const original = sharedInbox.runOnce.bind(sharedInbox);
    let calls = 0;
    const interception = mock.method(sharedInbox, 'runOnce', async (...[key, input, effect]: Parameters<typeof sharedInbox.runOnce>) => {
      if (key !== 'notifications.v1') return original(key, input, effect);
      calls += 1;
      if (calls === 2) competitor.release();
      return original(key, input, async (tx) => {
        entered.release();
        await competitor.promise;
        return effect(tx);
      });
    });
    const message = event('order.created', {
      orderId: randomUUID(), orderNumber: `OVERLAP-${token}`, trackingCode: 'TRACK-TEST', status: 'pending',
      totals: { subtotal: '10', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '10' },
      customerEmail: null, customerPhone: null, items: [],
    });
    let durableCompletion: Promise<unknown> | undefined;
    try {
      await persistEligibleIntent(message);
      const job = await eventQueue.add(message.eventName, message, { jobId: message.eventId });
      const finished = job.waitUntilFinished(events, 5000);
      durableCompletion = finished;
      await waitBarrier(entered, finished);
      await Promise.all([finished, publisher.publish(message)]);
      const rows = await prisma.notification.findMany({ where: { eventId: message.eventId } });
      assert.equal(rows.length, 1);
      assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId } }), 1);
      await publisher.publish(message);
      const repository = new PrismaNotificationRepository(prisma as never);
      await new NotificationDispatchRecoveryService(repository, notificationQueue).recoverBatch(message.eventId);
      await Promise.all([repository.flushAuditIntents(50), repository.flushAuditIntents(50)]);
      assert.equal(await prisma.auditLog.count({ where: { entityId: rows[0].id, action: 'notification.queued' } }), 1);
    } finally {
      competitor.release();
      if (durableCompletion) await Promise.allSettled([durableCompletion]);
      interception.mock.restore();
    }
  });

  it('rolls back notification intent and inbox completion when either queued write fails', async () => {
    let fault: 'notification' | 'audit' | null = null;
    let recoveryCalls = 0;
    const client = prisma.$extends({ query: {
      notification: {
        async createMany({ args, query }) {
          if (fault === 'notification') throw new Error('EX072_NOTIFICATION_INTENT_FAILURE');
          return query(args);
        },
      },
      notificationAuditIntent: {
        async createMany({ args, query }) {
          if (fault === 'audit') throw new Error('EX072_NOTIFICATION_AUDIT_INTENT_FAILURE');
          return query(args);
        },
      },
    } });
    const inbox = new PrismaDomainEventInboxRepository(client as never);
    const useCase = new QueueNotificationsFromEventUseCase(
      new NotificationTemplateService(), inbox,
      { enqueueEvent: async () => { recoveryCalls += 1; return []; } } as never,
    );
    const payload = {
      orderId: randomUUID(), orderNumber: `ROLLBACK-${randomUUID()}`, trackingCode: 'TRACK-ROLLBACK', status: 'pending',
      totals: { subtotal: '10', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '10' },
      customerEmail: 'synthetic@example.test', customerPhone: null, items: [],
    };

    for (const boundary of ['notification', 'audit'] as const) {
      const message = event('order.created', payload);
      fault = boundary;
      await assert.rejects(useCase.execute(message), new RegExp(`EX072_${boundary === 'notification' ? 'NOTIFICATION_INTENT' : 'NOTIFICATION_AUDIT_INTENT'}_FAILURE`));
      assert.equal(await prisma.notification.count({ where: { eventId: message.eventId } }), 0);
      assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'notifications.v1' } }), 0);
    }

    assert.equal(recoveryCalls, 0);
  });

  it('an unavailable audit sink cannot exhaust delivery attempts or strand the queued job', async () => {
    const queueName = `ex043-audit-outage-${token}`;
    const connection = redis.duplicate({ maxRetriesPerRequest: null });
    connections.push(connection);
    const queue = new Queue(queueName, { connection });
    const eventConnection = redis.duplicate({ maxRetriesPerRequest: null });
    connections.push(eventConnection);
    const queueEvents = new QueueEvents(queueName, { connection: eventConnection });
    const workerConnection = redis.duplicate({ maxRetriesPerRequest: null });
    connections.push(workerConnection);
    const repository = new PrismaNotificationRepository(prisma as never);
    const originalFlush = repository.flushAuditIntents.bind(repository);
    const outage = mock.method(repository, 'flushAuditIntents', async () => { throw new Error('EX043_AUDIT_OUTAGE'); });
    const sender = new SendNotificationUseCase(repository, {} as never, {} as never);
    const deliveryWorker = new Worker(queueName, async (job) => sender.execute(job.data.notificationId), { connection: workerConnection });
    try {
      await Promise.all([queue.waitUntilReady(), queueEvents.waitUntilReady(), deliveryWorker.waitUntilReady()]);
      const message = event('order.created', {
        orderId: randomUUID(), orderNumber: `AUDIT-OUTAGE-${token}`, trackingCode: 'TRACK-TEST', status: 'pending',
        totals: { subtotal: '10', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '10' },
        customerEmail: null, customerPhone: null, items: [],
      });
      const useCase = new QueueNotificationsFromEventUseCase(new NotificationTemplateService(), sharedInbox,
        new NotificationDispatchRecoveryService(repository, queue));
      await useCase.execute(message);
      const row = await prisma.notification.findFirstOrThrow({ where: { eventId: message.eventId } });
      const job = await queue.getJob(row.id);
      assert.ok(job);
      await job.waitUntilFinished(queueEvents, 5000);
      const sent = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(sent.status, 'sent');
      assert.equal(sent.attempts, 1);
      assert.equal((await queue.getJob(row.id))!.attemptsMade, 1);
      assert.equal(await prisma.notificationAuditIntent.count({ where: { notificationId: row.id, recordedAt: null } }), 2);
      outage.mock.restore();
      await Promise.all([originalFlush(50, row.id), originalFlush(50, row.id)]);
      await sender.execute(row.id);
      const intents = await prisma.notificationAuditIntent.findMany({ where: { notificationId: row.id } });
      const audits = await prisma.auditLog.findMany({ where: { entityId: row.id } });
      assert.equal(audits.length, 2);
      for (const intent of intents) assert.equal(audits.find((audit) => audit.id === intent.id)!.createdAt.getTime(), intent.createdAt.getTime());
      assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).attempts, 1);
    } finally {
      outage.mock.restore();
      await deliveryWorker.close();
      await queue.obliterate({ force: true });
      await Promise.all([queue.close(), queueEvents.close()]);
    }
  });

  it('recovers a sent audit failure without another provider call and fences stale failure audit', async () => {
    let failAudit = true;
    const client = prisma.$extends({ query: { auditLog: {
      async create({ args, query }) {
        if (failAudit) { failAudit = false; throw new Error('EX043_AUDIT_INSERT_FAILURE'); }
        return query(args);
      },
    } } });
    const repository = new PrismaNotificationRepository(client as never);
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId: randomUUID(), eventName: 'synthetic.audit', channel: 'email',
      recipient: 'synthetic@example.test', content: 'test', provider: 'mock_email',
    } });
    let sends = 0;
    const sender = new SendNotificationUseCase(repository,
      { send: async () => { sends += 1; return { providerMessageId: 'mock-proof' }; } } as never, {} as never);
    await sender.execute(id);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).status, 'sent');
    assert.equal(await prisma.auditLog.count({ where: { entityId: id } }), 0);
    await sender.execute(id);
    await sender.execute(id);
    assert.equal(sends, 1);
    assert.equal(await prisma.auditLog.count({ where: { entityId: id, action: 'notification.sent' } }), 1);

    const staleId = randomUUID();
    await prisma.notification.create({ data: {
      id: staleId, eventId: randomUUID(), eventName: 'synthetic.stale', channel: 'email',
      recipient: 'synthetic@example.test', content: 'test', provider: 'mock_email',
    } });
    const providerEntered = barrier();
    const providerRelease = barrier();
    const staleSender = new SendNotificationUseCase(repository, { send: async () => {
      providerEntered.release(); await providerRelease.promise;
      throw new NotificationDeliveryError('MOCK_EMAIL_NOT_SENT');
    } } as never, {} as never);
    const pending = staleSender.execute(staleId);
    try {
      await waitBarrier(providerEntered, pending);
      await prisma.notification.update({ where: { id: staleId }, data: { dispatchLeaseUntil: new Date(0) } });
      await repository.recoverExpiredSends(50);
      providerRelease.release();
      await pending;
    } finally { providerRelease.release(); await Promise.allSettled([pending]); }
    await repository.flushAuditIntents(50, staleId);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: staleId } })).status, 'uncertain');
    assert.equal(await prisma.auditLog.count({ where: { entityId: staleId, action: 'notification.failed' } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { entityId: staleId, action: 'notification.uncertain' } }), 1);
  });

  it('rolls back transition on intent failure and rolls back audit insertion on consumption failure', async () => {
    let fault: 'intent' | 'consume' | null = 'intent';
    const client = prisma.$extends({ query: { notificationAuditIntent: {
      async create({ args, query }) {
        if (fault === 'intent') throw new Error('EX043_INTENT_FAILURE');
        return query(args);
      },
      async update({ args, query }) {
        if (fault === 'consume') throw new Error('EX043_CONSUMPTION_FAILURE');
        return query(args);
      },
    } } });
    const repository = new PrismaNotificationRepository(client as never);
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId: randomUUID(), eventName: 'synthetic.atomic', channel: 'internal',
      recipient: 'internal', content: 'test', provider: 'internal', updatedAt: new Date(0),
    } });
    const claim = await repository.claimForSend(id, 120_000);
    assert.ok(claim);
    assert.ok((await prisma.notification.findUniqueOrThrow({ where: { id } })).updatedAt.getTime() > 0);
    await assert.rejects(repository.markSentWithClaim(id, claim.claimToken, 'mock'), /EX043_INTENT_FAILURE/);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).status, 'sending');
    assert.equal(await prisma.notificationAuditIntent.count({ where: { notificationId: id } }), 0);
    fault = null;
    assert.equal(await repository.markSentWithClaim(id, claim.claimToken, 'mock'), true);
    fault = 'consume';
    await assert.rejects(repository.flushAuditIntents(50, id), /EX043_CONSUMPTION_FAILURE/);
    assert.equal(await prisma.auditLog.count({ where: { entityId: id } }), 0);
    assert.equal(await prisma.notificationAuditIntent.count({ where: { notificationId: id, recordedAt: null } }), 1);
    fault = null;
    await Promise.all([repository.flushAuditIntents(50, id), repository.flushAuditIntents(50, id)]);
    assert.equal(await prisma.auditLog.count({ where: { entityId: id, action: 'notification.sent' } }), 1);
  });

  it('applies search projection and inbox completion atomically and idempotently', async () => {
    const contentId = randomUUID();
    await prisma.contentBlock.create({ data: {
      id: contentId, title: 'EX043 searchable evidence', slug: `ex043-${token}`, type: 'text_section',
      placementKey: `ex043-${token}`, body: { text: 'projection fixture' }, isPublished: true,
    } });
    const message = event('content.published', { contentId, placementKey: `ex043-${token}`, title: 'EX043 searchable evidence' });
    await persistEligibleIntent(message);
    const job = await eventQueue.add(message.eventName, message, { jobId: message.eventId });
    await Promise.all([job.waitUntilFinished(events, 5000), publisher.publish(message)]);

    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'search-projection.v1', status: 'completed' } }), 1);
    assert.equal(await prisma.searchDocument.count({ where: { contentBlockId: contentId, documentType: 'content' } }), 1);
    const projected = await waitFor(async () => prisma.searchDocument.findFirst({ where: { contentBlockId: contentId } }), 'projection missing');
    assert.equal(projected.isActive, true);
  });

  it('rolls back a search projection failure after the upsert and retries with one correct projection', async () => {
    const contentId = randomUUID();
    await prisma.contentBlock.create({ data: {
      id: contentId, title: 'EX043 retryable projection', slug: `ex043-retry-${token}`, type: 'text_section',
      placementKey: `ex043-retry-${token}`, body: { text: 'retry fixture' }, isPublished: true,
    } });

    let failAfterUpsert = true;
    const repository = new PrismaSearchRepository(prisma as never);
    const failingRepository = {
      lockVariantProjection: repository.lockVariantProjection.bind(repository),
      lockContentProjection: repository.lockContentProjection.bind(repository),
      upsertVariantDocuments: repository.upsertVariantDocuments.bind(repository),
      upsertContentDocuments: async (...args: Parameters<PrismaSearchRepository['upsertContentDocuments']>) => {
        await repository.upsertContentDocuments(...args);
        if (failAfterUpsert) {
          failAfterUpsert = false;
          throw new Error('synthetic failure after search upsert');
        }
      },
    };
    const localPublisher = new InMemoryDomainEventPublisher();
    const localRegistry = new DomainEventHandlerRegistry();
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    const subscriber = new SearchEventSubscriber(
      localPublisher,
      new ReindexContentUseCase(prisma as never, failingRepository as never),
      new ReindexVariantsUseCase(prisma as never, failingRepository as never),
      localRegistry,
      inbox,
    );
    subscriber.onModuleInit();
    const message = event('content.published', {
      contentId, placementKey: `ex043-retry-${token}`, title: 'EX043 retryable projection',
    });

    await assert.rejects(localRegistry.dispatch(message), /synthetic failure after search upsert/);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'search-projection.v1' } }), 0);
    assert.equal(await prisma.searchDocument.count({ where: { contentBlockId: contentId, documentType: 'content' } }), 0);

    await localRegistry.dispatch(message);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'search-projection.v1', status: 'completed' } }), 1);
    assert.equal(await prisma.searchDocument.count({ where: { contentBlockId: contentId, documentType: 'content' } }), 1);
  });

  it('commits bounded search progress and retries a failed second batch without premature completion', async () => {
    const ids = Array.from({ length: 53 }, () => randomUUID()).sort();
    await prisma.contentBlock.createMany({ data: ids.map((id) => ({
      id, title: 'EX043 batch', slug: `batch-${id}`, placementKey: `batch-${id}`,
      type: 'text_section' as const, body: {}, isPublished: true,
    })) });
    const repository = new PrismaSearchRepository(prisma as never);
    const useCase = new ReindexContentUseCase(prisma as never, repository);
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    const message = event('content.published', { contentId: ids[0], placementKey: 'batch', title: 'batch' });
    let batches = 0;
    const run = () => inbox.runBatches('search-projection.v1', message,
      (tx) => useCase.upperBound(tx, ids), async (tx, cursor, upper) => {
        const progress = await useCase.batch(tx, cursor, upper, ids);
        batches += 1;
        if (batches === 2) throw new Error('EX043_SECOND_BATCH_FAILURE');
        return progress;
      });
    await assert.rejects(run(), /EX043_SECOND_BATCH_FAILURE/);
    const receipt = await prisma.domainEventInbox.findUniqueOrThrow({ where: {
      consumerKey_eventId: { consumerKey: 'search-projection.v1', eventId: message.eventId },
    } });
    assert.equal(receipt.status, 'processing');
    assert.equal(receipt.progressCursor, ids[49]);
    assert.equal(await prisma.searchDocument.count({ where: { contentBlockId: { in: ids } } }), 50);
    await run();
    assert.equal(await prisma.searchDocument.count({ where: { contentBlockId: { in: ids } } }), 53);
    assert.equal((await prisma.domainEventInbox.findUniqueOrThrow({ where: { id: receipt.id } })).status, 'completed');
    const completedBatches = batches;
    await run();
    assert.equal(batches, completedBatches);
  });

  it('distinct overlapping projections reread two source rows after waiting for their locks', async () => {
    const ids = [randomUUID(), randomUUID()].sort();
    await prisma.contentBlock.createMany({ data: ids.map((id) => ({
      id, title: 'old title', slug: `overlap-${id}`, placementKey: `overlap-${id}`,
      type: 'text_section' as const, body: {}, isPublished: true,
    })) });
    const repository = new PrismaSearchRepository(prisma as never);
    const firstRead = barrier();
    const firstRelease = barrier();
    const secondWaiting = barrier();
    const firstUseCase = new ReindexContentUseCase(prisma as never, {
      lockContentProjection: repository.lockContentProjection.bind(repository),
      upsertContentDocuments: async (...args: Parameters<typeof repository.upsertContentDocuments>) => {
        firstRead.release(); await firstRelease.promise;
        return repository.upsertContentDocuments(...args);
      },
    } as never);
    const secondUseCase = new ReindexContentUseCase(prisma as never, {
      lockContentProjection: async (...args: Parameters<typeof repository.lockContentProjection>) => {
        secondWaiting.release(); return repository.lockContentProjection(...args);
      },
      upsertContentDocuments: repository.upsertContentDocuments.bind(repository),
    } as never);
    const updateUrl = new URL(process.env.DATABASE_URL!);
    updateUrl.searchParams.set('connection_limit', '1');
    const sourceClient = new PrismaClient({ datasources: { db: { url: updateUrl.toString() } } });
    const first = firstUseCase.execute(ids);
    let second: Promise<unknown> | undefined;
    try {
      await waitBarrier(firstRead, first);
      second = secondUseCase.execute(ids);
      await waitBarrier(secondWaiting, second);
      // A dedicated connection prevents pool starvation while two projection transactions wait.
      await sourceClient.contentBlock.updateMany({ where: { id: { in: ids } }, data: { title: 'new title after waiter' } });
      firstRelease.release();
      await Promise.all([first, second]);
    } finally {
      firstRelease.release();
      await Promise.allSettled(second ? [first, second] : [first]);
      await sourceClient.$disconnect();
    }
    const documents = await prisma.searchDocument.findMany({ where: { contentBlockId: { in: ids } } });
    assert.equal(documents.length, 2);
    assert.ok(documents.every((document) => document.title === 'new title after waiter'));
  });

  it('registered broad catalog reindex bounds variant locks and resumes after the second batch fails', async () => {
    const ids = Array.from({ length: 52 }, () => randomUUID()).sort();
    await prisma.variant.createMany({ data: ids.map((id) => ({ id, name: 'EX043 batch variant', sku: `EX043-${id}`, price: '10' })) });
    const repository = new PrismaSearchRepository(prisma as never);
    let fail = true;
    let batches = 0;
    const originalUpsert = repository.upsertVariantDocuments.bind(repository);
    const injection = mock.method(repository, 'upsertVariantDocuments', async (...args: Parameters<typeof originalUpsert>) => {
      assert.ok(args[0].length <= 50);
      await originalUpsert(...args);
      batches += 1;
      if (fail && batches === 2) { fail = false; throw new Error('EX043_VARIANT_BATCH_FAILURE'); }
    });
    const localRegistry = new DomainEventHandlerRegistry();
    const localPublisher = new InMemoryDomainEventPublisher();
    const subscriber = new SearchEventSubscriber(localPublisher,
      new ReindexContentUseCase(prisma as never, repository),
      new ReindexVariantsUseCase(prisma as never, repository), localRegistry, sharedInbox);
    subscriber.onModuleInit();
    const message: VersionedDomainEvent = {
      eventId: randomUUID(), eventName: 'brand.updated', eventVersion: 'v1', occurredAt: new Date().toISOString(),
      payload: { brandId: randomUUID(), slug: 'ex043-synthetic', isActive: true },
    };
    try {
      await assert.rejects(localRegistry.dispatch(message), /EX043_VARIANT_BATCH_FAILURE/);
      const receipt = await prisma.domainEventInbox.findUniqueOrThrow({ where: { consumerKey_eventId: {
        consumerKey: 'search-projection.v1', eventId: message.eventId!,
      } } });
      assert.equal(receipt.status, 'processing');
      assert.equal(receipt.completedAt, null);
      assert.equal(await prisma.searchDocument.count({ where: { variantId: { in: ids } } }), 50);
      await localRegistry.dispatch(message);
      assert.equal(await prisma.searchDocument.count({ where: { variantId: { in: ids } } }), 52);
      assert.equal((await prisma.domainEventInbox.findUniqueOrThrow({ where: { id: receipt.id } })).status, 'completed');
    } finally { injection.mock.restore(); localPublisher.onModuleDestroy(); }
  });

  it('serializes concurrent consumer duplicates, isolates consumer keys, and rolls back failed effects', async () => {
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    const message = event('order.created', {
      orderId: randomUUID(), orderNumber: `EX043-INBOX-${token}`, trackingCode: 'TRACK-TEST', status: 'pending',
      totals: { subtotal: '1', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '1' },
      customerEmail: null, customerPhone: null, items: [],
    });
    let effects = 0;
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => inbox.runOnce('test.concurrent.v1', message, async () => {
      effects += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    })));
    assert.equal(effects, 1);
    assert.equal(concurrent.filter((result) => result.status === 'processed').length, 1);
    assert.deepEqual(await inbox.runOnce('test.other-consumer.v1', message, async () => { effects += 1; }), { status: 'processed', value: undefined });
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId } }), 2);

    const retryMessage = { ...message, eventId: randomUUID() };
    await assert.rejects(inbox.runOnce('test.failure.v1', retryMessage, async () => { throw new Error('synthetic effect failure'); }));
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: retryMessage.eventId } }), 0);
    assert.deepEqual(await inbox.runOnce('test.failure.v1', retryMessage, async () => 'recovered'), { status: 'processed', value: 'recovered' });
  });

  it('fails closed for an unimplemented durable event handler', async () => {
    await assert.rejects(registry.dispatch({
      eventId: randomUUID(), eventName: 'payment.intent_created', eventVersion: 'v1', occurredAt: new Date().toISOString(),
      payload: { paymentId: randomUUID(), orderId: randomUUID(), gateway: 'manual', gatewayReference: null, status: 'pending' },
    }), MissingDomainEventHandlerError);
  });

  it('recovers a committed intent after Redis enqueue failure using the original notification IDs', async () => {
    const message = event('order.created', {
      orderId: randomUUID(), orderNumber: `EX043-RECOVERY-${token}`, trackingCode: 'TRACK-TEST', status: 'pending',
      totals: { subtotal: '20', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '20' },
      customerEmail: `recovery-${token}@example.test`, customerPhone: null,
      items: [{ sku: 'SKU-RECOVERY', name: 'Synthetic recovery item', quantity: 1, unitPrice: '20', lineTotal: '20' }],
    });
    const repository = new PrismaNotificationRepository(prisma as never);
    let failOnce = true;
    const queuePort = {
      getJob: (...args: Parameters<Queue['getJob']>) => notificationQueue.getJob(...args),
      add: async (...args: Parameters<Queue['add']>) => {
        if (failOnce) { failOnce = false; throw new Error('synthetic Redis enqueue failure'); }
        return notificationQueue.add(...args);
      },
    };
    const recovery = new NotificationDispatchRecoveryService(repository, queuePort as never, 5_000, 10);
    const useCase = new QueueNotificationsFromEventUseCase(new NotificationTemplateService(), new PrismaDomainEventInboxRepository(prisma as never), recovery);

    await useCase.execute(message);
    const persisted = await prisma.notification.findMany({ where: { eventId: message.eventId }, orderBy: { id: 'asc' } });
    assert.equal(persisted.length, 2);
    const firstAttemptJobs = await notificationQueue.getJobs(['waiting']);
    assert.equal(firstAttemptJobs.filter((job) => persisted.some((row) => row.id === job.id)).length, 0,
      'a Redis enqueue failure must release claims and circuit-break immediate retries');
    await new Promise((resolve) => setTimeout(resolve, 15));
    await recovery.recoverBatch();
    await useCase.execute(message);

    const recovered = await notificationQueue.getJobs(['waiting']);
    assert.deepEqual(recovered.map((job) => job.id).filter((id) => persisted.some((row) => row.id === id)).sort(), persisted.map((row) => row.id).sort());
    assert.equal(await prisma.notification.count({ where: { eventId: message.eventId } }), 2);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: message.eventId, consumerKey: 'notifications.v1' } }), 1);
  });

  it('fences concurrent notification send claims and preserves the sent guard after queue removal', async () => {
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId: randomUUID(), eventName: 'synthetic.send', channel: NotificationChannel.internal,
      recipient: 'ops@internal', content: 'synthetic', provider: 'internal-log', status: 'queued', dispatchEligible: true,
    } });
    const repository = new PrismaNotificationRepository(prisma as never);
    const [claimA, claimB] = await Promise.all([repository.claimForSend(id, 60_000), repository.claimForSend(id, 60_000)]);
    assert.equal([claimA, claimB].filter(Boolean).length, 1);
    const owner = claimA ?? claimB;
    assert.ok(owner);
    assert.equal(await repository.markSentWithClaim(id, owner.claimToken, 'synthetic-provider-id'), true);
    assert.equal(await repository.markSentWithClaim(id, owner.claimToken, 'stale-provider-id'), false);
    await notificationQueue.add('send-notification', { notificationId: id }, { jobId: id });
    await notificationQueue.getJob(id).then((job) => job?.remove());
    await new NotificationDispatchRecoveryService(repository, notificationQueue as never).recoverBatch();
    assert.equal(await notificationQueue.getJob(id), undefined);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).status, 'sent');
  });

  it('reconstructs only the remaining bounded retry after Redis loses a failed notification job', async () => {
    const eventId = randomUUID();
    const retryId = randomUUID();
    const exhaustedId = randomUUID();
    await prisma.notification.createMany({ data: [
      {
        id: retryId, eventId, eventName: 'synthetic.retryable', channel: NotificationChannel.internal,
        recipient: 'retryable-internal', content: 'synthetic', provider: 'internal-log',
        status: 'failed', attempts: 1, dispatchEligible: true,
      },
      {
        id: exhaustedId, eventId, eventName: 'synthetic.retryable', channel: NotificationChannel.internal,
        recipient: 'exhausted-internal', content: 'synthetic', provider: 'internal-log',
        status: 'failed', attempts: 3, dispatchEligible: true,
      },
    ] });

    const repository = new PrismaNotificationRepository(prisma as never);
    const recovery = new NotificationDispatchRecoveryService(repository, notificationQueue as never);
    const [claimsA, claimsB] = await Promise.all([
      repository.claimDispatchBatch(10, 30_000, eventId),
      repository.claimDispatchBatch(10, 30_000, eventId),
    ]);
    const acquired = [...claimsA, ...claimsB];
    assert.equal(acquired.length, 1, 'concurrent recovery workers cannot claim the same retry row twice');
    await repository.releaseDispatchClaim(acquired[0].id, acquired[0].claimToken);
    assert.deepEqual(await recovery.recoverBatch(eventId), [retryId]);

    const recoveredJob = await notificationQueue.getJob(retryId);
    assert.ok(recoveredJob, 'a missing Redis retry job is reconstructed from the durable failed row');
    assert.equal(recoveredJob.id, retryId);
    assert.equal(await notificationQueue.getJob(exhaustedId), undefined, 'exhausted attempts remain parked for review');
    const claim = await repository.claimForSend(retryId, 30_000);
    assert.ok(claim, 'the reconstructed stable job can claim the next provider attempt');
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: retryId } })).attempts, 2);
    assert.equal(await repository.claimForSend(exhaustedId, 30_000), null);
    assert.equal(await repository.markFailedWithClaim(retryId, claim.claimToken, 'RETRY_NOT_SENT'), true);
    await repository.flushAuditIntents(10, retryId);
    await recoveredJob.remove();
  });

  it('reactivates a retained failed BullMQ job using its stable ID when PostgreSQL still permits a retry', async () => {
    const eventId = randomUUID();
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId, eventName: 'synthetic.retained-failure', channel: NotificationChannel.internal,
      recipient: 'retryable-internal', content: 'synthetic', provider: 'internal-log',
      status: 'failed', attempts: 1, dispatchEligible: true,
    } });

    const failedWorkerConnection = redis.duplicate({ maxRetriesPerRequest: null });
    connections.push(failedWorkerConnection);
    const failedWorker = new Worker(notificationQueueName, async () => {
      throw new Error('synthetic worker-level failure before database claim');
    }, { connection: failedWorkerConnection, concurrency: 1 });
    const failed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('worker did not fail the seeded job')), 5_000);
      failedWorker.on('failed', (job) => {
        if (job?.id === id) { clearTimeout(timeout); resolve(); }
      });
    });
    await notificationQueue.add('send-notification', { notificationId: id }, {
      jobId: id, attempts: 1, removeOnFail: false,
    });
    await failed;
    await failedWorker.close();

    const retained = await notificationQueue.getJob(id);
    assert.ok(retained);
    assert.equal(await retained.getState(), 'failed');
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).attempts, 1,
      'a worker-level failure before claim does not spend a provider-attempt budget');

    const recoveryA = new NotificationDispatchRecoveryService(
      new PrismaNotificationRepository(prisma as never), notificationQueue as never,
    );
    const recoveryB = new NotificationDispatchRecoveryService(
      new PrismaNotificationRepository(prisma as never), notificationQueue as never,
    );
    const recovered = await Promise.all([recoveryA.recoverBatch(eventId), recoveryB.recoverBatch(eventId)]);
    assert.equal(recovered.flat().filter((notificationId) => notificationId === id).length, 1,
      'independent recovery instances coordinate through the durable claim lease');
    const sameJob = await notificationQueue.getJob(id);
    assert.equal(sameJob?.id, id, 'recovery preserves the stable BullMQ job identity');
    assert.ok(['waiting', 'delayed', 'active'].includes(await sameJob!.getState()),
      'a retained failed job is returned to executable queue state');
    assert.equal((await notificationQueue.getJobs(['waiting', 'delayed', 'active'])).filter((job) => job.id === id).length, 1);
    await sameJob!.remove();
  });

  it('rebuilds a completed transport job only while DB intent remains eligible and survives re-add failure', async () => {
    const eventId = randomUUID();
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId, eventName: 'synthetic.completed-transport', channel: NotificationChannel.internal,
      recipient: 'retryable-internal', content: 'synthetic', provider: 'internal-log',
      status: 'failed', attempts: 1, dispatchEligible: true,
    } });

    const completedWorkerConnection = redis.duplicate({ maxRetriesPerRequest: null });
    connections.push(completedWorkerConnection);
    const completedWorker = new Worker(notificationQueueName, async () => undefined, {
      connection: completedWorkerConnection, concurrency: 1,
    });
    const completed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('worker did not complete the seeded job')), 5_000);
      completedWorker.on('completed', (job) => {
        if (job.id === id) { clearTimeout(timeout); resolve(); }
      });
    });
    await notificationQueue.add('send-notification', { notificationId: id }, {
      jobId: id, attempts: 1, removeOnComplete: false,
    });
    await completed;
    await completedWorker.close();
    assert.equal(await (await notificationQueue.getJob(id))?.getState(), 'completed');

    let failReAdd = true;
    const queuePort = {
      getJob: (...args: Parameters<Queue['getJob']>) => notificationQueue.getJob(...args),
      add: async (...args: Parameters<Queue['add']>) => {
        if (failReAdd) { failReAdd = false; throw new Error('synthetic Redis re-add failure'); }
        return notificationQueue.add(...args);
      },
    };
    const firstRecovery = new NotificationDispatchRecoveryService(
      new PrismaNotificationRepository(prisma as never), queuePort as never, 5_000, 10,
    );
    assert.deepEqual(await firstRecovery.recoverBatch(eventId), []);
    assert.equal(await notificationQueue.getJob(id), undefined,
      'failed re-add leaves no misleading completed transport job');
    const durableRow = await prisma.notification.findUniqueOrThrow({ where: { id } });
    assert.equal(durableRow.status, 'failed');
    assert.equal(durableRow.attempts, 1);
    assert.equal(durableRow.dispatchClaimToken, null, 'failed enqueue releases the durable dispatch claim');

    const secondRecovery = new NotificationDispatchRecoveryService(
      new PrismaNotificationRepository(prisma as never), notificationQueue as never,
    );
    assert.deepEqual(await secondRecovery.recoverBatch(eventId), [id]);
    const rebuilt = await notificationQueue.getJob(id);
    assert.equal(rebuilt?.id, id, 'DB intent recreates transport with the exact same identity');
    assert.ok(['waiting', 'delayed', 'active'].includes(await rebuilt!.getState()));
    await rebuilt!.remove();
  });

  it('fails closed when an existing BullMQ job reuses a notification ID with conflicting identity', async () => {
    const eventId = randomUUID();
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId, eventName: 'synthetic.identity-conflict', channel: NotificationChannel.internal,
      recipient: 'retryable-internal', content: 'synthetic', provider: 'internal-log',
      status: 'failed', attempts: 1, dispatchEligible: true,
    } });
    await notificationQueue.add('unexpected-job-name', { notificationId: randomUUID() }, {
      jobId: id, attempts: 1, removeOnFail: false,
    });

    const recovery = new NotificationDispatchRecoveryService(
      new PrismaNotificationRepository(prisma as never), notificationQueue as never,
    );
    assert.deepEqual(await recovery.recoverBatch(eventId), [], 'identity conflict must not report dispatch acceptance');
    const notification = await prisma.notification.findUniqueOrThrow({ where: { id } });
    assert.equal(notification.status, 'failed');
    assert.equal(notification.attempts, 1);
    assert.equal(notification.dispatchClaimToken, null, 'conflict handling releases the durable claim');
    const conflicting = await notificationQueue.getJob(id);
    assert.equal(conflicting?.name, 'unexpected-job-name', 'recovery does not rewrite a conflicting queue payload');
    await conflicting!.remove();
  });

  it('moves expired in-flight provider attempts to uncertain instead of resending', async () => {
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId: randomUUID(), eventName: 'synthetic.expired-send', channel: NotificationChannel.internal,
      recipient: 'ops@internal', content: 'synthetic', provider: 'internal-log', status: 'sending',
      dispatchEligible: true, dispatchClaimToken: randomUUID(), dispatchLeaseUntil: new Date(Date.now() - 1000),
    } });
    const repository = new PrismaNotificationRepository(prisma as never);
    assert.equal(await repository.recoverExpiredSends(10), 1);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).status, 'uncertain');
    assert.equal(await repository.claimForSend(id, 60_000), null);
  });

  it('parks an expired sending row without a legacy claim token and persists its audit intent', async () => {
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId: randomUUID(), eventName: 'synthetic.legacy-expired-send', channel: NotificationChannel.internal,
      recipient: 'ops@internal', content: 'synthetic', provider: 'internal-log', status: 'sending',
      dispatchEligible: true, dispatchLeaseUntil: new Date(Date.now() - 1000),
    } });
    const repository = new PrismaNotificationRepository(prisma as never);

    assert.equal(await repository.recoverExpiredSends(10), 1);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).status, 'uncertain');
    assert.equal(await prisma.notificationAuditIntent.count({ where: {
      notificationId: id, action: 'notification.uncertain', recordedAt: null,
    } }), 1);
  });

  it('keeps pre-existing queued notification rows ineligible for startup recovery', async () => {
    const eventId = randomUUID();
    const id = randomUUID();
    await prisma.notification.create({ data: {
      id, eventId, eventName: 'legacy.held', channel: NotificationChannel.internal,
      recipient: 'ops@internal', content: 'synthetic legacy row', provider: 'internal-log', status: 'queued',
    } });
    const repository = new PrismaNotificationRepository(prisma as never);
    const recovery = new NotificationDispatchRecoveryService(repository, notificationQueue as never);
    await recovery.recoverBatch();
    assert.equal(await notificationQueue.getJob(id), undefined);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id } })).dispatchEligible, false);
  });

  it('keeps synthetic historical sent, missing, partial-consumer, and uncertain events held during recovery', async () => {
    const fixtures = [
      { kind: 'legacy_sent', eventName: 'order.created', notificationStatus: 'sent', receiptConsumer: null },
      { kind: 'missing_intent', eventName: 'order.created', notificationStatus: null, receiptConsumer: null },
      // This synthetic event declares notifications.v1 and search-projection.v1 as required owners;
      // only the notification receipt is present. It does not claim a production event has this fanout.
      { kind: 'partial_consumers', eventName: 'synthetic.multi_consumer', notificationStatus: 'sent', receiptConsumer: 'notifications.v1' },
      { kind: 'uncertain', eventName: 'payment.approved', notificationStatus: 'uncertain', receiptConsumer: null },
    ] as const;
    const expectedStatuses = new Map<string, string>();
    const expectedEligibility = new Map<string, boolean>();
    const heldEventIds: string[] = [];
    const notificationIds: string[] = [];

    for (const fixture of fixtures) {
      const eventId = randomUUID();
      heldEventIds.push(eventId);
      await prisma.domainEventOutbox.create({ data: {
        eventId, eventName: fixture.eventName, eventVersion: 'v1',
        payload: fixture.kind === 'partial_consumers'
          ? { synthetic: true, requiredConsumerKeys: ['notifications.v1', 'search-projection.v1'] }
          : { orderId: randomUUID(), orderNumber: `EX043-${fixture.kind}`, status: 'pending' },
        occurredAt: new Date(), eligibility: 'held', holdReason: 'legacy_delivery_requires_reconciliation',
        state: 'pending', nextAttemptAt: new Date(0),
      } });

      if (fixture.notificationStatus) {
        const notificationId = randomUUID();
        notificationIds.push(notificationId);
        expectedStatuses.set(notificationId, fixture.notificationStatus);
        expectedEligibility.set(notificationId, fixture.kind === 'uncertain');
        await prisma.notification.create({ data: {
          id: notificationId, eventId, eventName: fixture.eventName, channel: NotificationChannel.internal,
          recipient: 'ops@internal', content: `synthetic-${fixture.kind}`, provider: 'internal-log',
          status: fixture.notificationStatus, dispatchEligible: fixture.kind === 'uncertain',
        } });
      }

      if (fixture.receiptConsumer) {
        await prisma.domainEventInbox.create({ data: {
          id: randomUUID(), consumerKey: fixture.receiptConsumer, eventId,
          envelopeHash: 'a'.repeat(64), status: 'completed',
        } });
      }
    }

    const repository = new PrismaNotificationRepository(prisma as never);
    const recovery = new NotificationDispatchRecoveryService(repository, notificationQueue as never);
    await recovery.recoverBatch();

    const heldRows = await prisma.domainEventOutbox.findMany({ where: { eventId: { in: heldEventIds } } });
    assert.equal(heldRows.length, fixtures.length);
    assert.ok(heldRows.every((row) => row.eligibility === 'held' && row.state === 'pending'));
    const partialEventId = heldRows.find((row) => row.eventName === 'synthetic.multi_consumer')!.eventId;
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: partialEventId, consumerKey: 'notifications.v1', status: 'completed' } }), 1);
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: partialEventId, consumerKey: 'search-projection.v1' } }), 0);
    for (const notificationId of notificationIds) {
      const row = await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
      assert.equal(row.status, expectedStatuses.get(notificationId));
      assert.equal(row.dispatchEligible, expectedEligibility.get(notificationId));
      assert.equal(await notificationQueue.getJob(notificationId), undefined);
    }
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: { in: heldEventIds } } }), 1);
  });
});
