import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';
import { DomainEventRedisOutageError } from 'src/infra/events/domain-event-delivery-policy';
import { ConflictingDomainEventReplayError } from 'src/infra/events/prisma-domain-event-inbox.repository';

const data = {
  eventId: 'event-1', eventName: 'brand.created', eventVersion: 'v1',
  occurredAt: '2026-10-06T12:00:00.000Z',
  payload: { brandId: 'brand-1', slug: 'brand', isActive: true },
};

const job = (jobData: unknown) => ({ data: jobData }) as Job;
const parking = {
  getOutboxEligibility: async () => 'eligible' as const,
  resolve: async () => 0,
  recordFailure: async () => undefined,
  recordTransientFailure: async () => ({ businessAttempts: 1, attemptsInReplay: 1, parked: false }),
} as never;

describe('DomainEventsWorker', () => {
  it('rejects a known event with no registered handler instead of ACKing it', async () => {
    const worker = new DomainEventsWorker(new DomainEventHandlerRegistry(), parking);
    await assert.rejects(worker.process(job(data)));
  });

  it('does not dispatch held events and durably records the rejected routing attempt', async () => {
    let calls = 0;
    const registry = new DomainEventHandlerRegistry();
    registry.register('brand.created', 'search-projection.v1', async () => { calls += 1; });
    const failures: Array<Record<string, unknown>> = [];
    const heldParking = {
      getOutboxEligibility: async () => 'held' as const,
      recordFailure: async (failure: Record<string, unknown>) => { failures.push(failure); },
    } as never;

    await assert.rejects(new DomainEventsWorker(registry, heldParking).process(job(data)), /not eligible for delivery/);
    assert.equal(calls, 0);
    assert.equal(failures[0]?.errorCategory, 'HELD_EVENT_NOT_ELIGIBLE');
  });

  it('rejects unknown events and unsupported versions before dispatch', async () => {
    const registry = new DomainEventHandlerRegistry();
    let calls = 0;
    registry.register('brand.created', 'search-projection.v1', async () => { calls += 1; });
    const worker = new DomainEventsWorker(registry, parking);
    await assert.rejects(worker.process(job({ ...data, eventName: 'unknown.event' })));
    await assert.rejects(worker.process(job({ ...data, eventVersion: 'v2' })));
    await assert.rejects(worker.process(job({ ...data, eventId: undefined })));
    assert.equal(calls, 0);
  });

  it('dispatches a valid registered handler once and propagates its error', async () => {
    const registry = new DomainEventHandlerRegistry();
    let calls = 0;
    registry.register('brand.created', 'search-projection.v1', async () => { calls += 1; });
    const worker = new DomainEventsWorker(registry, parking);
    await worker.process(job(data));
    assert.equal(calls, 1);

    const expected = new Error('retry me');
    const failingRegistry = new DomainEventHandlerRegistry();
    failingRegistry.register('brand.created', 'search-projection.v1', async () => { throw expected; });
    await assert.rejects(new DomainEventsWorker(failingRegistry, parking).process(job(data)), (error: unknown) => error === expected);
  });

  it('classifies a consumer interruption as queue outage when the dedicated worker Redis client is disconnected', async () => {
    const registry = new DomainEventHandlerRegistry();
    registry.register('brand.created', 'search-projection.v1', async () => { throw new Error('dependency interruption'); });
    const worker = new DomainEventsWorker(registry, parking);
    Object.defineProperty(worker, 'worker', { value: { client: { status: 'reconnecting' } } });
    await assert.rejects(worker.process(job(data)), DomainEventRedisOutageError);
  });

  it('parks conflicting inbox identity durably and fails the delivery terminally', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const parkingRepository = {
      getOutboxEligibility: async () => 'eligible' as const,
      resolve: async () => 0,
      recordFailure: async (failure: Record<string, unknown>) => { recorded.push(failure); },
    } as never;
    const registry = new DomainEventHandlerRegistry();
    registry.register('brand.created', 'search-projection.v1', async () => {
      throw new ConflictingDomainEventReplayError();
    });
    const worker = new DomainEventsWorker(registry, parkingRepository);

    await assert.rejects(worker.process(job(data)), UnrecoverableError);
    assert.deepEqual(recorded, [{
      eventId: data.eventId,
      eventName: data.eventName,
      consumerKey: 'search-projection.v1',
      failureClass: 'terminal',
      errorCategory: 'INBOX_IDENTITY_CONFLICT',
      businessAttempts: 1,
    }]);
  });

  it('does not log event payload or PII when dispatch fails', async () => {
    const worker = new DomainEventsWorker(new DomainEventHandlerRegistry(), parking);
    const messages: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      await assert.rejects(worker.process(job({ ...data, payload: { email: 'secret@example.com', phone: '3111234567', token: 'secret' } })));
    } finally {
      console.warn = original;
    }
    assert.equal(messages.join(' ').includes('secret@example.com'), false);
    assert.equal(messages.join(' ').includes('3111234567'), false);
    assert.equal(messages.join(' ').includes('secret'), false);
  });
});
