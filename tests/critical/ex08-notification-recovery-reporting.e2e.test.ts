import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it, mock } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { NotificationDispatchRecoveryService } from 'src/modules/notifications/infrastructure/queue/notification-dispatch-recovery.service';
import { PrismaNotificationRepository } from 'src/modules/notifications/infrastructure/repositories/prisma-notification.repository';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';
import { assertDisposableTarget } from 'tests/helpers/ex07-4-disposable-target';

describe('EX-08 notification recovery reporting over isolated PostgreSQL and Redis', () => {
  const prisma = new PrismaClient();
  const ids: string[] = [];
  const connections: Redis[] = [];
  const workers: Worker[] = [];
  const queueName = `ex08-recovery-${randomUUID()}`;
  let redis: Redis;
  let queue: Queue;
  let events: QueueEvents;

  before(async () => {
    assertDisposableTarget();
    redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const connection = () => {
      const result = redis.duplicate({ maxRetriesPerRequest: null });
      connections.push(result);
      return result;
    };
    queue = new Queue(queueName, { connection: connection() });
    events = new QueueEvents(queueName, { connection: connection() });
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
  });

  after(async () => {
    await Promise.allSettled(workers.map((worker) => worker.close()));
    if (queue) await queue.obliterate({ force: true });
    await Promise.allSettled([events?.close(), queue?.close(), redis?.quit()]);
    for (const connection of connections) connection.disconnect();
    await prisma.notificationAuditIntent.deleteMany({ where: { notificationId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityType: 'notification', entityId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  for (const initialTransport of ['failed', 'completed', 'missing'] as const) {
    it(`reports one recovery for a ${initialTransport} transport when a second replica claims after the first release`, async () => {
      const id = randomUUID();
      const eventId = randomUUID();
      ids.push(id);
      await prisma.notification.create({ data: {
        id, eventId, eventName: 'synthetic.ex08-reporting', channel: 'email',
        recipient: 'synthetic@example.test', content: 'Synthetic recovery reporting test', provider: 'test-only',
        status: 'failed', attempts: 1, dispatchEligible: true,
      } });
      if (initialTransport !== 'missing') {
        const connection = redis.duplicate({ maxRetriesPerRequest: null });
        connections.push(connection);
        const worker = new Worker(queueName, async () => {
          if (initialTransport === 'failed') throw new Error('Synthetic failure before provider claim');
        }, { connection });
        workers.push(worker);
        const job = await queue.add('send-notification', { notificationId: id }, {
          jobId: id, attempts: 1, removeOnFail: false, removeOnComplete: false,
        });
        if (initialTransport === 'failed') await assert.rejects(job.waitUntilFinished(events, 5_000), /Synthetic failure/);
        else await job.waitUntilFinished(events, 5_000);
        await worker.close();
        assert.equal(await (await queue.getJob(id))!.getState(), initialTransport);
      }

      const first = new PrismaNotificationRepository(prisma as never);
      const secondClient = new PrismaClient();
      const second = new PrismaNotificationRepository(secondClient as never);
      let released!: () => void;
      let releaseDeadline: NodeJS.Timeout | undefined;
      const afterFirstRelease = new Promise<void>((resolve, reject) => {
        released = resolve;
        releaseDeadline = setTimeout(() => reject(new Error('First dispatch lease release deadline exceeded')), 4_000);
      });
      let secondClaims = 0;
      const realRelease = first.releaseDispatchClaim.bind(first);
      const realClaim = second.claimDispatchBatch.bind(second);
      const releaseGate = mock.method(first, 'releaseDispatchClaim', async (...args: Parameters<typeof realRelease>) => {
        await realRelease(...args);
        if (releaseDeadline) clearTimeout(releaseDeadline);
        released();
      });
      const claimGate = mock.method(second, 'claimDispatchBatch', async (...args: Parameters<typeof realClaim>) => {
        // Force the CI interleaving without sleeps: B scans only after A releases its durable lease.
        await afterFirstRelease;
        const claims = await realClaim(...args);
        secondClaims = claims.length;
        return claims;
      });
      try {
        const results = await Promise.all([
          new NotificationDispatchRecoveryService(first, queue as never).recoverBatch(eventId),
          new NotificationDispatchRecoveryService(second, queue as never).enqueueEvent(eventId),
        ]);
        assert.equal(secondClaims, 1, 'the later replica really acquires the released PostgreSQL lease');
        const jobs = (await queue.getJobs(['waiting', 'active', 'delayed'])).filter((job) => job.id === id);
        assert.equal(jobs.length, 1, 'the duplicated report must not be mistaken for duplicate transport identity');
        assert.equal(jobs[0].id, id);

        let deliveries = 0;
        const send = new SendNotificationUseCase(first, {
          send: async () => { deliveries += 1; return { providerMessageId: 'synthetic-only' }; },
        } as never, { send: async () => { throw new Error('No WhatsApp provider is authorized'); } } as never);
        await Promise.all([send.execute(id), send.execute(id)]);
        assert.equal(deliveries, 1, 'the durable send claim permits one synthetic provider attempt');
        const row = await prisma.notification.findUniqueOrThrow({ where: { id } });
        assert.equal(row.status, 'sent');
        assert.equal(row.attempts, 2, 'transport recovery does not consume a delivery attempt');
        assert.equal(await prisma.auditLog.count({ where: { entityId: id, action: 'notification.sent' } }), 1);
        await jobs[0].remove();
        assert.equal(results.flat().filter((value) => value === id).length, 1,
          'only the replica that changes transport into executable state reports a recovery');
      } finally {
        if (releaseDeadline) clearTimeout(releaseDeadline);
        releaseGate.mock.restore();
        claimGate.mock.restore();
        await secondClient.$disconnect();
      }
    });
  }
});
