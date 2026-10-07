import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedWorkerShutdown } from 'src/infra/queue/bounded-worker-shutdown';

test('worker stops claims, drains active work, then closes gracefully', async () => {
  const calls: string[] = [];
  const result = await boundedWorkerShutdown({
    pause: async (doNotWaitActive) => { calls.push(`pause:${doNotWaitActive}`); },
    close: async (force) => { calls.push(`close:${force}`); },
  }, 100);
  assert.deepEqual(result, { drained: true });
  assert.deepEqual(calls, ['pause:false', 'close:false']);
});

test('deadline forces worker close without claiming the interrupted delivery succeeded', async () => {
  const calls: string[] = [];
  const result = await boundedWorkerShutdown({
    pause: async () => new Promise<void>(() => undefined),
    close: async (force) => { calls.push(`close:${force}`); },
  }, 10);
  assert.deepEqual(result, { drained: false });
  assert.deepEqual(calls, ['close:true']);
});
