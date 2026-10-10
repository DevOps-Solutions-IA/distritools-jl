import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationDispatchRecoveryService } from 'src/modules/notifications/infrastructure/queue/notification-dispatch-recovery.service';

for (const state of ['waiting', 'active', 'delayed', 'waiting-children', 'prioritized']) {
  test(`an existing ${state} transport is not reported as newly recovered`, async () => {
    const repository = {
      recoverExpiredSends: async () => 0,
      flushAuditIntents: async () => 0,
      claimDispatchBatch: async () => [{ id: 'notification-1', claimToken: 'claim-1' }],
      releaseDispatchClaim: async () => undefined,
    };
    const queue = {
      getJob: async () => ({
        name: 'send-notification', data: { notificationId: 'notification-1' },
        getState: async () => state,
      }),
      add: async () => { throw new Error('An executable transport must not be recreated'); },
    };
    const recovery = new NotificationDispatchRecoveryService(repository as never, queue as never);
    assert.deepEqual(await recovery.enqueueEvent('event-1'), []);
  });
}

test('an already executable transport does not prevent a later missing transport from being recovered', async () => {
  let present = true;
  const repository = {
    recoverExpiredSends: async () => 0,
    flushAuditIntents: async () => 0,
    claimDispatchBatch: async () => [{ id: 'notification-1', claimToken: 'claim-1' }],
    releaseDispatchClaim: async () => undefined,
  };
  const queue = {
    getJob: async () => present ? {
      name: 'send-notification', data: { notificationId: 'notification-1' }, getState: async () => 'waiting',
    } : undefined,
    add: async () => ({ id: 'notification-1' }),
  };
  const recovery = new NotificationDispatchRecoveryService(repository as never, queue as never);
  assert.deepEqual(await recovery.recoverBatch('event-1'), []);
  present = false;
  assert.deepEqual(await recovery.recoverBatch('event-1'), ['notification-1']);
});
