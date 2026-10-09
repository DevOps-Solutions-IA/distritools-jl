import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationDispatchRecoveryService } from 'src/modules/notifications/infrastructure/queue/notification-dispatch-recovery.service';

test('one Redis enqueue failure opens a bounded circuit, releases the batch and suppresses immediate reclaims', async () => {
  let claims = 0;
  let adds = 0;
  const released: string[] = [];
  const repository = {
    recoverExpiredSends: async () => 0,
    flushAuditIntents: async () => 0,
    claimDispatchBatch: async () => {
      claims += 1;
      return [1, 2, 3].map((id) => ({ id: `notification-${id}`, claimToken: `claim-${id}` }));
    },
    releaseDispatchClaim: async (id: string) => { released.push(id); },
  };
  const queue = {
    getJob: async () => undefined,
    add: async () => { adds += 1; throw Object.assign(new Error('redis unavailable'), { code: 'ECONNREFUSED' }); },
  };
  const recovery = new NotificationDispatchRecoveryService(repository as never, queue as never);

  assert.deepEqual(await recovery.recoverBatch(), []);
  assert.equal(adds, 1);
  assert.deepEqual(released.sort(), ['notification-1', 'notification-2', 'notification-3']);
  assert.deepEqual(await recovery.recoverBatch(), []);
  assert.equal(claims, 1);
  assert.equal(adds, 1);
});

test('shutdown stops new claims and waits only for its bounded active batch', async () => {
  let resolveAdd!: () => void;
  let notifyAddStarted!: () => void;
  const addStarted = new Promise<void>((resolve) => { notifyAddStarted = resolve; });
  let claimCalls = 0;
  const adding = new Promise<void>((resolve) => { resolveAdd = resolve; });
  const repository = {
    recoverExpiredSends: async () => 0,
    flushAuditIntents: async () => 0,
    claimDispatchBatch: async () => { claimCalls += 1; return [{ id: 'notification-1', claimToken: 'claim-1' }]; },
    releaseDispatchClaim: async () => undefined,
  };
  const queue = { getJob: async () => undefined, add: async () => { notifyAddStarted(); return adding; } };
  const recovery = new NotificationDispatchRecoveryService(repository as never, queue as never, 20);
  const active = recovery.recoverBatch();
  await addStarted;
  await recovery.onModuleDestroy();
  assert.deepEqual(await recovery.recoverBatch(), []);
  assert.equal(claimCalls, 1);
  resolveAdd();
  await active;
});
