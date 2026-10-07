import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { DomainEventCutoverReadinessService } from 'src/infra/events/domain-event-cutover-readiness.service';

describe('persisted domain-event cutover readiness dry-run', () => {
  it('returns bounded redacted eligibility and blocks held, gapped and uncertain events', async () => {
    const at = new Date('2026-10-07T12:00:00.000Z');
    const prisma = {
      domainEventOutbox: { findMany: async () => [
        { eventId: '00000000-0000-7000-8000-000000000001', eventName: 'order.created', eventVersion: 'v1',
          eligibility: 'cutover_pending', holdReason: null, state: 'enqueued', createdAt: at,
          routingDecision: { route: 'durable', reason: 'TEST_ONLY_DURABLE', policyVersion: 'ex045.v1' }, payload: { customerEmail: 'private@example.test' } },
        { eventId: '00000000-0000-7000-8000-000000000002', eventName: 'order.paid', eventVersion: 'v1',
          eligibility: 'held', holdReason: 'legacy_delivery_requires_reconciliation', state: 'pending', createdAt: at,
          routingDecision: { route: 'legacy_hold', reason: 'REQUIRED_CONSUMER_GAP', policyVersion: 'ex045.v1' }, payload: { customerEmail: 'private@example.test' } },
      ] },
      domainEventInbox: { findMany: async () => [
        { eventId: '00000000-0000-7000-8000-000000000001', consumerKey: 'notifications.v1', status: 'completed' },
      ] },
      domainEventParking: { findMany: async () => [] },
      notification: { groupBy: async () => [
        { eventId: '00000000-0000-7000-8000-000000000001', status: 'uncertain', _count: { _all: 1 } },
      ] },
    };
    const registry = new DomainEventHandlerRegistry();
    registry.register('order.created', 'notifications.v1', async () => undefined);
    const service = new DomainEventCutoverReadinessService(prisma as never, registry);
    const result = await service.evaluate({ limit: 2 });

    assert.equal(result.readOnly, true);
    assert.equal(result.bounded, true);
    assert.equal(result.consumerDispositionMatrix.length > 0, true);
    assert.ok(result.consumerDispositionMatrix.some((item) => item.eventName === 'order.paid' && !item.eligible));
    assert.ok(result.consumerDispositionMatrix.some((item) => item.eventName === 'inventory.low_stock_detected' && !item.eligible));
    assert.equal(result.items[0].cutoverEligible, false);
    assert.ok(result.items[0].ineligibilityReasons.includes('NOTIFICATION_OUTCOME_UNCERTAIN'));
    assert.ok(result.items[0].ineligibilityReasons.includes('MIXED_VERSION_FENCE_NOT_ACTIVATED'));
    assert.deepEqual(result.items[0].completedConsumers, ['notifications.v1']);
    assert.equal(result.items[1].held, true);
    assert.ok(result.items[1].ineligibilityReasons.includes('PERSISTED_ROUTE_IS_LEGACY_HOLD'));
    assert.equal(JSON.stringify(result).includes('private@example.test'), false);
    assert.equal(JSON.stringify(result).includes('payload'), false);
    assert.equal(result.nextCursor, `${at.toISOString()}|00000000-0000-7000-8000-000000000002`);
  });

  it('rejects unbounded limits and malformed cursors', async () => {
    const service = new DomainEventCutoverReadinessService({} as never, new DomainEventHandlerRegistry());
    await assert.rejects(() => service.evaluate({ limit: 51 }), /Limit must be between/);
    await assert.rejects(() => service.evaluate({ cursor: 'not-a-cursor' }), /Invalid cursor/);
  });
});
