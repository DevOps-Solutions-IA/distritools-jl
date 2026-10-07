import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDeliveryFailure, deliveryRetryDelayMs, DomainEventRedisOutageError, shouldParkDelivery } from 'src/infra/events/domain-event-delivery-policy';
import { DomainEventContractError } from 'src/common/events/domain-event.contracts';
import { MissingDomainEventHandlerError } from 'src/infra/events/domain-event-handler.registry';
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';
import { ConflictingDomainEventReplayError } from 'src/infra/events/prisma-domain-event-inbox.repository';

test('classifies only explicit queue outage signals as outage, not arbitrary network-coded consumer errors', () => {
  const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  assert.equal(classifyDeliveryFailure(error, 'consumer'), 'transient');
  assert.equal(classifyDeliveryFailure(new DomainEventRedisOutageError()), 'outage');
  assert.equal(shouldParkDelivery('outage', 0), false);
});

test('parks terminal contract and missing-consumer failures without ACKing them', () => {
  assert.equal(classifyDeliveryFailure(new DomainEventContractError('INVALID_ENVELOPE', 'bad envelope')), 'terminal');
  assert.equal(classifyDeliveryFailure(new MissingDomainEventHandlerError('order.paid')), 'terminal');
  assert.equal(classifyDeliveryFailure(new ConflictingDomainEventReplayError(), 'consumer'), 'terminal');
  assert.equal(shouldParkDelivery('terminal', 1), true);
});

test('keeps notification not-sent retry bounded and ambiguous outcomes parked', () => {
  assert.equal(classifyDeliveryFailure(new NotificationDeliveryError('PROVIDER_REJECTED')), 'transient');
  assert.equal(classifyDeliveryFailure(new Error('unknown provider result')), 'ambiguous');
  assert.equal(shouldParkDelivery('transient', 4), false);
  assert.equal(shouldParkDelivery('transient', 5), true);
  assert.equal(shouldParkDelivery('ambiguous', 1), true);
});

test('uses capped exponential backoff with bounded jitter', () => {
  assert.equal(deliveryRetryDelayMs(1, () => 0), 1000);
  assert.equal(deliveryRetryDelayMs(1, () => 1), 3000);
  assert.equal(deliveryRetryDelayMs(20, () => 1), 60_000);
});
