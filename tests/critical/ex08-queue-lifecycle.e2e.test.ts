import 'tests/helpers/test-env';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, getQueueToken, getQueueOptionsToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { createServer, connect, Socket } from 'node:net';
import { once } from 'node:events';
import { RoleAwareWorker } from 'src/infra/queue/role-aware-worker';
import { BullQueueModule } from 'src/infra/queue/bullmq.module';
import { createProducerRedisOptions } from 'src/infra/queue/redis-role-connection-options';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { PrismaDomainEventParkingRepository } from 'src/infra/events/prisma-domain-event-parking.repository';
import { NotificationsProcessor } from 'src/modules/notifications/infrastructure/queue/notifications.processor';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';
import { assertDisposableTarget } from 'tests/helpers/ex07-4-disposable-target';

async function createQueueApp() {
  const prefix = `ex08-lifecycle-${randomUUID()}`;
  const builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      BullQueueModule,
      BullModule.registerQueueAsync({
        name: 'notifications',
        useFactory: (config: ConfigService) => ({ connection: createProducerRedisOptions(config.get<string>('REDIS_URL')!) }),
        inject: [ConfigService],
      }),
    ],
    providers: [
      DomainEventsWorker, NotificationsProcessor,
      { provide: DomainEventHandlerRegistry, useValue: {} },
      { provide: PrismaDomainEventParkingRepository, useValue: {} },
      { provide: SendNotificationUseCase, useValue: { execute: () => { throw new Error('No provider or job is authorized'); } } },
    ],
  });
  // Override only queue options to isolate the fixture; Nest still constructs the queues and real processors.
  for (const name of ['auth', 'domain-events', 'notifications']) {
    builder.overrideProvider(getQueueOptionsToken(name)).useFactory({
      factory: (config: ConfigService) => ({ name, prefix, connection: createProducerRedisOptions(config.get<string>('REDIS_URL')!) }),
      inject: [ConfigService],
    });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  for (const name of ['auth', 'domain-events', 'notifications']) {
    assert.equal(app.get<Queue>(getQueueToken(name), { strict: false }).opts.prefix, prefix);
  }
  await app.init();
  for (const worker of [app.get(DomainEventsWorker).worker, app.get(NotificationsProcessor).worker]) {
    assert.equal(worker.opts.prefix, prefix);
  }
  return app;
}

describe('EX-08 real queue lifecycle without database or provider effects', () => {
  it('closes thirty application instances after producer queue readiness without late worker initialization rejections', { timeout: 20_000 }, async () => {
    assertDisposableTarget();
    for (let cycle = 0; cycle < 30; cycle += 1) {
      const app = await createQueueApp();
      try {
        for (const name of ['auth', 'domain-events', 'notifications']) {
          await app.get<Queue>(getQueueToken(name), { strict: false }).waitUntilReady();
        }
      } finally {
        // Deliberately use the existing test lifecycle: queues ready, then app.close.
        await app.close();
      }
    }
  });

  it('uses persistent worker options while keeping the injected producer queues fail-fast', async () => {
    assertDisposableTarget();
    const app = await createQueueApp();
    try {
      for (const name of ['auth', 'domain-events', 'notifications']) {
        const queue = app.get<Queue>(getQueueToken(name), { strict: false });
        await queue.waitUntilReady();
        const connection = queue.opts.connection as ReturnType<typeof createProducerRedisOptions>;
        assert.equal(connection.enableOfflineQueue, false);
        assert.equal(connection.maxRetriesPerRequest, 1);
        assert.equal(connection.retryStrategy?.(1), null);
      }
      const workers = [app.get(DomainEventsWorker).worker, app.get(NotificationsProcessor).worker];
      for (const worker of workers) {
        const connection = worker.opts.connection as ReturnType<typeof createProducerRedisOptions>;
        assert.equal(connection.enableOfflineQueue, true);
        assert.equal(connection.maxRetriesPerRequest, null);
        assert.equal(typeof connection.retryStrategy?.(1), 'number');
        const target = new URL(process.env.REDIS_URL!);
        assert.equal(connection.host, target.hostname);
        assert.equal(connection.port, Number(target.port || 6379));
        assert.equal(connection.db, Number(target.pathname.slice(1) || 0));
      }
    } finally {
      await app.close();
    }
  });
});

async function bounded<T>(promise: Promise<T>, milliseconds = 4_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Fixture deadline exceeded')), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function proxyToDisposableRedis() {
  assertDisposableTarget();
  const target = new URL(process.env.REDIS_URL!);
  const sockets = new Set<Socket>();
  const server = createServer((incoming) => {
    const upstream = connect(Number(target.port || 6379), target.hostname);
    for (const socket of [incoming, upstream]) {
      sockets.add(socket);
      socket.on('error', () => socket.destroy());
      socket.on('close', () => sockets.delete(socket));
    }
    incoming.pipe(upstream).pipe(incoming);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = new URL(target);
  url.hostname = '127.0.0.1'; url.port = String(address.port);
  const disconnect = () => { for (const socket of sockets) socket.destroy(); };
  return { url: url.toString(), disconnect, close: async () => {
    disconnect();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } };
}

async function unavailableLocalRedisUrl() {
  assertDisposableTarget();
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `redis://127.0.0.1:${address.port}/0`;
}

describe('EX-08 worker outage and shutdown boundaries', () => {
  it('reconnects both worker connections after an isolated transport cut', { timeout: 10_000 }, async () => {
    const proxy = await proxyToDisposableRedis();
    const worker = new RoleAwareWorker(`ex08-reconnect-${randomUUID()}`, async () => undefined, {
      connection: createProducerRedisOptions(proxy.url),
    });
    const errors: Error[] = [];
    worker.on('error', (error) => errors.push(error));
    try {
      const primary = await worker.client;
      const blocking = await worker.waitUntilReady();
      const primaryReady = new Promise<void>((resolve) => primary.once('ready', resolve));
      const blockingReady = new Promise<void>((resolve) => blocking.once('ready', resolve));
      proxy.disconnect();
      await bounded(Promise.all([primaryReady, blockingReady]));
      assert.equal(primary.status, 'ready');
      assert.equal(blocking.status, 'ready');
      assert.equal(primary.options.enableOfflineQueue, true);
      assert.equal(blocking.options.maxRetriesPerRequest, null);
    } finally {
      await worker.close();
      await proxy.close();
    }
  });

  it('rejects producer enqueue promptly after transport loss without offline buffering', { timeout: 10_000 }, async () => {
    const proxy = await proxyToDisposableRedis();
    const queue = new Queue(`ex08-producer-${randomUUID()}`, { connection: createProducerRedisOptions(proxy.url) });
    const errors: Error[] = [];
    queue.on('error', (error) => errors.push(error));
    let proxyClosed = false;
    try {
      const client = await queue.waitUntilReady();
      const ended = new Promise<void>((resolve) => client.once('end', resolve));
      await proxy.close(); proxyClosed = true;
      await bounded(ended);
      const started = Date.now();
      await assert.rejects(bounded(queue.add('synthetic', {}), 1_000), /Connection is closed|Stream isn't writeable/);
      assert.ok(Date.now() - started < 1_000);
      assert.equal(client.options.enableOfflineQueue, false);
      assert.equal(client.options.maxRetriesPerRequest, 1);
      assert.equal(client.options.retryStrategy?.(1), null);
    } finally {
      if (proxyClosed) {
        // The persistent outage also makes the producer's final QUIT fail-fast.
        try { await queue.close(); } catch (error) {
          assert.match((error as Error).message, /Connection is closed|Stream isn't writeable/);
        }
        assert.equal(queue.closed, true);
      } else { await queue.close(); await proxy.close(); }
    }
  });

  for (const force of [false, true]) {
    it(`cleans up unavailable Redis and propagates the ${force ? '250ms forced' : '5s graceful'} initialization deadline`, { timeout: 10_000 }, async () => {
      const worker = new RoleAwareWorker(`ex08-unavailable-${randomUUID()}`, async () => undefined, {
        connection: createProducerRedisOptions(await unavailableLocalRedisUrl()),
      });
      const errors: Error[] = [];
      worker.on('error', (error) => errors.push(error));
      const started = Date.now();
      await assert.rejects(worker.close(force), /initialization deadline exceeded/);
      assert.ok(Date.now() - started < (force ? 2_000 : 7_000));
      assert.equal(worker.closed, true);
      assert.ok(errors.some((error) => error.message.includes('ECONNREFUSED')));
    });
  }
  it('forced shutdown preempts a graceful initialization wait on unavailable Redis', { timeout: 10_000 }, async () => {
    const worker = new RoleAwareWorker(`ex08-preempt-${randomUUID()}`, async () => undefined, {
      connection: createProducerRedisOptions(await unavailableLocalRedisUrl()),
    });
    const errors: Error[] = [];
    worker.on('error', (error) => errors.push(error));
    const graceful = assert.rejects(worker.close(), /initialization deadline exceeded|Connection is closed/);
    const started = Date.now();
    await assert.rejects(worker.close(true), /initialization deadline exceeded/);
    assert.ok(Date.now() - started < 2_000);
    await bounded(graceful, 6_000);
    assert.equal(worker.closed, true);
  });

});
