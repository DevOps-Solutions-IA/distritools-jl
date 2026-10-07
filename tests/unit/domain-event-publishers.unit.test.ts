import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { Queue } from 'bullmq';
import { DOMAIN_EVENT_PUBLISHER } from 'src/common/events/domain-event.publisher';
import { InMemoryDomainEventPublisher, DomainEventsModule } from 'src/infra/events/in-memory-domain-event.publisher';
import { BullMqDomainEventPublisher, DomainEventEnqueueOutcomeUnknownError } from 'src/infra/events/bullmq-domain-event.publisher';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';

describe('domain event publishers', () => {
  it('keeps the in-memory publisher as the default runtime binding', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, DomainEventsModule) as Array<Record<string, unknown>>;
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, DomainEventsModule) as unknown[];
    assert.ok(providers.some((provider) =>
      provider.provide === DOMAIN_EVENT_PUBLISHER && provider.useExisting === InMemoryDomainEventPublisher,
    ));
    assert.ok(exports.includes(DomainEventHandlerRegistry));
  });

  it('preserves the BullMQ envelope and stable event ID job key', async () => {
    let added: { name: string; data: unknown; options: unknown } | undefined;
    const queue = {
      add: async (name: string, data: unknown, options: unknown) => {
        added = { name, data, options };
        return {};
      },
    } as unknown as Queue;
    const publisher = new BullMqDomainEventPublisher(queue);
    await publisher.publish({
      eventId: 'event-1',
      eventName: 'brand.created',
      eventVersion: 'v1',
      occurredAt: '2026-10-06T12:00:00.000Z',
      correlationId: 'correlation-1',
      payload: { brandId: 'brand-1', slug: 'brand', isActive: true },
    });

    assert.deepEqual(added, {
      name: 'brand.created',
      data: {
        eventId: 'event-1', eventName: 'brand.created', eventVersion: 'v1',
        payload: { brandId: 'brand-1', slug: 'brand', isActive: true },
        occurredAt: '2026-10-06T12:00:00.000Z', correlationId: 'correlation-1',
      },
      options: {
        jobId: 'event-1', attempts: 5, backoff: { type: 'exponential', delay: 2000, jitter: 0.5 },
        removeOnComplete: { age: 604800, count: 10000 }, removeOnFail: false,
      },
    });
  });

  it('returns an unknown enqueue outcome on deadline while retaining the stable event identity', async () => {
    let addedJobId: string | undefined;
    const queue = {
      add: async (_name: string, _data: unknown, options: { jobId: string }) => {
        addedJobId = options.jobId;
        return new Promise(() => undefined);
      },
    } as unknown as Queue;
    const publisher = new BullMqDomainEventPublisher(queue, 10);
    await assert.rejects(publisher.publish({
      eventId: 'stable-event-id', eventName: 'brand.created', eventVersion: 'v1',
      occurredAt: '2026-10-06T12:00:00.000Z',
      payload: { brandId: 'brand-1', slug: 'brand', isActive: true },
    }), DomainEventEnqueueOutcomeUnknownError);
    assert.equal(addedJobId, 'stable-event-id');
  });

  it('rejects malformed in-memory publications before invoking subscribers', async () => {
    const publisher = new InMemoryDomainEventPublisher();
    let calls = 0;
    publisher.subscribe('brand.created', () => { calls += 1; });
    await assert.rejects(Reflect.apply(publisher.publish, publisher, [{
      eventName: 'brand.created', eventVersion: 'v1',
      occurredAt: '2026-10-06T12:00:00.000Z',
      payload: { brandId: 'brand-1', slug: 'brand', isActive: 'true' },
    }]));
    assert.equal(calls, 0);
    publisher.onModuleDestroy();
  });
});
