import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDomainEventQueueMutationEnabled, assessDomainEventReplayEligibility, isIsolatedDomainEventRuntime } from 'src/infra/events/domain-event-replay-policy';
import { getDomainEventsWorkerProvider } from 'src/infra/events/in-memory-domain-event.publisher';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';

test('historical held events are never eligible for replay', () => {
  assert.deepEqual(assessDomainEventReplayEligibility({
    eligibility: 'held', disposition: 'in_memory_consumed', requiredConsumers: ['notifications'],
    registeredConsumers: ['notifications.v1'], completedConsumers: [],
  }), { eligible: false, reason: 'HISTORICAL_HELD' });
});

test('queue mutations fail closed outside isolated test mode', () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    assert.equal(isIsolatedDomainEventRuntime(), false);
    assert.deepEqual(getDomainEventsWorkerProvider(), { provide: DomainEventsWorker, useValue: null });
    assert.throws(assertDomainEventQueueMutationEnabled, /disabled outside isolated tests/);
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    assert.equal(isIsolatedDomainEventRuntime(), true);
    assert.equal(getDomainEventsWorkerProvider(), DomainEventsWorker);
    assert.doesNotThrow(assertDomainEventQueueMutationEnabled);
  } finally {
    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('missing required consumer coverage blocks replay instead of inventing a handler', () => {
  assert.deepEqual(assessDomainEventReplayEligibility({
    eligibility: 'eligible', disposition: 'known_consumer_gap', requiredConsumers: ['notifications'],
    registeredConsumers: [], completedConsumers: [],
  }), { eligible: false, reason: 'REQUIRED_CONSUMER_GAP' });
});

test('completed consumer receipt suppresses replay, pending receipt permits only covered replay', () => {
  const completed = assessDomainEventReplayEligibility({
    eligibility: 'eligible', disposition: 'in_memory_consumed', requiredConsumers: ['notifications'],
    registeredConsumers: ['notifications.v1'], completedConsumers: ['notifications.v1'],
  });
  assert.deepEqual(completed, { eligible: false, reason: 'CONSUMERS_ALREADY_COMPLETED' });

  const pending = assessDomainEventReplayEligibility({
    eligibility: 'eligible', disposition: 'in_memory_consumed', requiredConsumers: ['notifications'],
    registeredConsumers: ['notifications.v1'], completedConsumers: [],
  });
  assert.deepEqual(pending, { eligible: true, reason: 'SAFE_INCOMPLETE_DELIVERY' });
});
