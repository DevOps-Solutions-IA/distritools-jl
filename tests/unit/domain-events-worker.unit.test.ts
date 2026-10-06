import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Job } from 'bullmq';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';

const data = {
  eventId: 'event-1', eventName: 'brand.created', eventVersion: 'v1',
  occurredAt: '2026-10-06T12:00:00.000Z',
  payload: { brandId: 'brand-1', slug: 'brand', isActive: true },
};

const job = (jobData: unknown) => ({ data: jobData }) as Job;

describe('DomainEventsWorker', () => {
  it('rejects a known event with no registered handler instead of ACKing it', async () => {
    const worker = new DomainEventsWorker(new DomainEventHandlerRegistry());
    await assert.rejects(worker.process(job(data)));
  });

  it('rejects unknown events and unsupported versions before dispatch', async () => {
    const registry = new DomainEventHandlerRegistry();
    let calls = 0;
    registry.register('brand.created', 'test-consumer', async () => { calls += 1; });
    const worker = new DomainEventsWorker(registry);
    await assert.rejects(worker.process(job({ ...data, eventName: 'unknown.event' })));
    await assert.rejects(worker.process(job({ ...data, eventVersion: 'v2' })));
    await assert.rejects(worker.process(job({ ...data, eventId: undefined })));
    assert.equal(calls, 0);
  });

  it('dispatches a valid registered handler once and propagates its error', async () => {
    const registry = new DomainEventHandlerRegistry();
    let calls = 0;
    registry.register('brand.created', 'test-consumer', async () => { calls += 1; });
    const worker = new DomainEventsWorker(registry);
    await worker.process(job(data));
    assert.equal(calls, 1);

    const expected = new Error('retry me');
    const failingRegistry = new DomainEventHandlerRegistry();
    failingRegistry.register('brand.created', 'failing-consumer', async () => { throw expected; });
    await assert.rejects(new DomainEventsWorker(failingRegistry).process(job(data)), (error: unknown) => error === expected);
  });

  it('does not log event payload or PII when dispatch fails', async () => {
    const worker = new DomainEventsWorker(new DomainEventHandlerRegistry());
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
