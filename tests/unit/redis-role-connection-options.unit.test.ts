import assert from 'node:assert/strict';
import test from 'node:test';
import { createProducerRedisOptions, createWorkerRedisOptions } from 'src/infra/queue/redis-role-connection-options';

test('producer Redis options are fail-fast and bounded', () => {
  const options = createProducerRedisOptions('redis://user:secret@127.0.0.1:39143/2');
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 39143);
  assert.equal(options.db, 2);
  assert.equal(options.username, 'user');
  assert.equal(options.password, 'secret');
  assert.equal(options.connectTimeout, 5_000);
  assert.equal(options.maxRetriesPerRequest, 1);
  assert.equal(options.enableOfflineQueue, false);
  assert.equal(options.retryStrategy?.(1), null);
});

test('worker Redis options are persistent with bounded reconnect backoff', () => {
  const options = createWorkerRedisOptions('rediss://:secret@redis.example:6380', () => 0.5);
  assert.equal(options.host, 'redis.example');
  assert.equal(options.port, 6380);
  assert.equal(options.maxRetriesPerRequest, null);
  assert.equal(options.enableOfflineQueue, true);
  assert.equal(options.retryStrategy?.(2), 2_000);
  assert.equal(options.retryStrategy?.(100), 30_000);
  assert.ok(options.tls);
  const lowJitter = createWorkerRedisOptions('redis://localhost', () => 0);
  const highJitter = createWorkerRedisOptions('redis://localhost', () => 1);
  assert.equal(lowJitter.retryStrategy?.(2), 1_000);
  assert.equal(highJitter.retryStrategy?.(2), 3_000);
});
