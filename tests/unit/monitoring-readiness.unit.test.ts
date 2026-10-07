import assert from 'node:assert/strict';
import test from 'node:test';
import { MonitoringController } from 'src/infra/monitoring/monitoring.controller';

test('liveness stays process-only while readiness bounds Redis failures', async () => {
  const response = { code: 200, status(code: number) { this.code = code; return this; } };
  const controller = new MonitoringController(
    { $queryRaw: async () => [{ ok: 1 }] } as never,
    { waitUntilReady: async () => undefined, client: Promise.resolve({ ping: async () => new Promise<string>(() => undefined) }) } as never,
    { worker: { client: Promise.resolve({ status: 'ready', ping: async () => 'PONG' }) } } as never,
    { snapshot: () => ({}) } as never,
    15,
  );

  assert.equal(controller.getHealth().status, 'ok');
  const startedAt = Date.now();
  const readiness = await controller.getReadiness(response as never);
  assert.ok(Date.now() - startedAt < 250);
  assert.equal(readiness.status, 'degraded');
  assert.equal(response.code, 503);
  assert.equal(readiness.checks.database, 'ok');
  assert.equal(readiness.checks.queueProducer, 'unavailable');
  assert.equal(readiness.checks.queueWorker, 'ready');
});

test('readiness is degraded when PostgreSQL is unavailable', async () => {
  const response = { code: 200, status(code: number) { this.code = code; return this; } };
  const controller = new MonitoringController(
    { $queryRaw: async () => { throw new Error('database down'); } } as never,
    { waitUntilReady: async () => undefined, client: Promise.resolve({ ping: async () => 'PONG' }) } as never,
    { worker: { client: Promise.resolve({ status: 'ready', ping: async () => 'PONG' }) } } as never,
    { snapshot: () => ({}) } as never,
    15,
  );
  const readiness = await controller.getReadiness(response as never);
  assert.equal(readiness.status, 'degraded');
  assert.equal(response.code, 503);
  assert.equal(readiness.checks.database, 'unavailable');
});

test('API-role readiness does not require the disabled durable domain worker', async () => {
  const response = { code: 200, status(code: number) { this.code = code; return this; } };
  const controller = new MonitoringController(
    { $queryRaw: async () => [{ ok: 1 }] } as never,
    { waitUntilReady: async () => undefined, client: Promise.resolve({ ping: async () => 'PONG' }) } as never,
    null,
    { snapshot: () => ({}) } as never,
    15,
  );
  const readiness = await controller.getReadiness(response as never);
  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.checks.queueWorker, 'not_required_for_api_role');
  assert.equal(response.code, 200);
});
