import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { Worker } from 'bullmq';
import { RoleAwareWorker } from 'src/infra/queue/role-aware-worker';
import { createProducerRedisOptions, createWorkerRedisOptionsFromConnection } from 'src/infra/queue/redis-role-connection-options';

function gate() {
  let resolve!: (value: { status: string }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ status: string }>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function workerWithConnections(primary: ReturnType<typeof gate>, blocking: ReturnType<typeof gate>) {
  return Object.assign(Object.create(RoleAwareWorker.prototype) as RoleAwareWorker, {
    connection: { client: primary.promise }, blockingConnection: { client: blocking.promise },
  });
}

test('persistent worker conversion preserves the configured TLS, identity and database without changing producer options', () => {
  const producer = createProducerRedisOptions('rediss://qa%20user:synthetic%2Fonly@127.0.0.1:39143/4');
  const before = { ...producer };
  const worker = createWorkerRedisOptionsFromConnection(producer, () => 0.5);
  assert.equal(worker.host, '127.0.0.1');
  assert.equal(worker.port, 39143);
  assert.equal(worker.db, 4);
  assert.equal(worker.username, 'qa user');
  assert.equal(worker.password, 'synthetic/only');
  assert.equal(worker.tls, producer.tls);
  assert.equal(worker.connectTimeout, 5_000);
  assert.equal(worker.enableReadyCheck, true);
  assert.equal(worker.enableOfflineQueue, true);
  assert.equal(worker.maxRetriesPerRequest, null);
  assert.equal(worker.retryStrategy?.(2), 2_000);
  assert.equal(worker.retryStrategy?.(100), 30_000);
  assert.deepEqual(producer, before);
  assert.equal(producer.enableOfflineQueue, false);
  assert.equal(producer.maxRetriesPerRequest, 1);
  assert.equal(producer.retryStrategy?.(1), null);
});

test('SDK close waits for both primary and blocking initialization promises', async () => {
  const primary = gate();
  const blocking = gate();
  const worker = workerWithConnections(primary, blocking);
  let transportClosed = false;
  const close = mock.method(Worker.prototype, 'close', async () => { transportClosed = true; });
  try {
    const operation = worker.close();
    primary.resolve({ status: 'ready' });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(transportClosed, false, 'primary readiness alone is insufficient');
    blocking.resolve({ status: 'ready' });
    await operation;
    assert.equal(transportClosed, true);
  } finally { close.mock.restore(); }
});

for (const rejectedConnection of ['primary', 'blocking'] as const) {
  test(`a rejected ${rejectedConnection} initialization closes transport and reports the failure`, async () => {
    const primary = gate();
    const blocking = gate();
    const worker = workerWithConnections(primary, blocking);
    let transportClosed = false;
    const close = mock.method(Worker.prototype, 'close', async () => { transportClosed = true; });
    try {
      const operation = worker.close();
      const failure = new Error('Synthetic initialization rejected');
      if (rejectedConnection === 'primary') primary.reject(failure);
      else { primary.resolve({ status: 'ready' }); blocking.reject(failure); }
      await assert.rejects(operation, (error) => error === failure);
      assert.equal(transportClosed, true);
    } finally { close.mock.restore(); }
  });
}

test('graceful initialization timeout closes transport and fails instead of claiming readiness', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const worker = workerWithConnections(gate(), gate());
  let transportClosed = false;
  const close = mock.method(Worker.prototype, 'close', async () => { transportClosed = true; });
  try {
    const operation = worker.close();
    const rejected = assert.rejects(operation, /Worker connection initialization deadline exceeded/);
    mock.timers.tick(5_000);
    await rejected;
    assert.equal(transportClosed, true);
  } finally { close.mock.restore(); mock.timers.reset(); }
});

test('forced close bounds initialization waiting within the existing two second force budget', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const worker = workerWithConnections(gate(), gate());
  let transportClosed = false;
  const close = mock.method(Worker.prototype, 'close', async () => { transportClosed = true; });
  try {
    const operation = worker.close(true);
    const rejected = assert.rejects(operation, /Worker connection initialization deadline exceeded/);
    mock.timers.tick(250);
    await rejected;
    assert.equal(transportClosed, true);
  } finally { close.mock.restore(); mock.timers.reset(); }
});
