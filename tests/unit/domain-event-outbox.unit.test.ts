import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomainEventOutboxRelay } from 'src/infra/events/domain-event-outbox-relay';
import { DomainEventEnqueueOutcomeUnknownError } from 'src/infra/events/bullmq-domain-event.publisher';
import { PrismaDomainEventOutboxRepository } from 'src/infra/events/prisma-domain-event-outbox.repository';
import type { OutboxClaim, OutboxRelayRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { DomainEventsModule, InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { DOMAIN_EVENT_PUBLISHER } from 'src/common/events/domain-event.publisher';

const event = {
  eventName: 'order.cancelled', eventVersion: 'v1', occurredAt: '2026-10-06T18:00:00.000Z',
  payload: { orderId: 'order-1', orderNumber: 'DT-1', status: 'cancelled', customerEmail: null, customerPhone: null },
} as const;

describe('durable event outbox boundaries', () => {
  it('preserves in-memory runtime binding and does not register a relay entrypoint', () => {
    const providers: unknown[] = Reflect.getMetadata('providers', DomainEventsModule);
    assert.ok(providers.includes(InMemoryDomainEventPublisher));
    assert.equal(providers.includes(DomainEventOutboxRelay), false);
    const binding = providers.find((provider) => typeof provider === 'object' && provider !== null &&
      'provide' in provider && provider.provide === DOMAIN_EVENT_PUBLISHER);
    assert.deepEqual(binding, { provide: DOMAIN_EVENT_PUBLISHER, useExisting: InMemoryDomainEventPublisher });
  });
  const isolated = async (operation: () => Promise<void>) => {
    const previous = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
    process.env.NODE_ENV = 'test'; process.env.APP_ENV = 'test';
    try { await operation(); } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  };
  it('captures with the supplied transaction, stable ID and immutable held routing', async () => {
    let data: Record<string, unknown> | undefined;
    const tx = { domainEventOutbox: { create: async (input: { data: Record<string, unknown> }) => { data = input.data; } } };
    const repository = new PrismaDomainEventOutboxRepository({} as PrismaService);
    const captured = await repository.captureHeld(tx as unknown as PrismaTransactionClient, event);
    assert.match(captured.eventId, /^[0-9a-f-]{36}$/);
    assert.equal(data?.eventId, captured.eventId);
    assert.equal(data?.eligibility, 'held');
    assert.equal(data?.state, 'pending');
    assert.equal(data?.holdReason, 'legacy_delivery_requires_reconciliation');
    assert.deepEqual(captured.payload, event.payload);
  });

  it('propagates an insert error so the caller transaction can roll back', async () => {
    const failure = new Error('insert failure');
    const tx = { domainEventOutbox: { create: async () => { throw failure; } } };
    await assert.rejects(new PrismaDomainEventOutboxRepository({} as PrismaService)
      .captureHeld(tx as unknown as PrismaTransactionClient, event), (e: unknown) => e === failure);
  });

  it('keeps every normal relay invocation disabled regardless of flags', async () => {
    const previous = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
    process.env.NODE_ENV = 'production'; process.env.APP_ENV = 'production';
    let calls = 0;
    try {
      const repo = { claimEligible: async () => { calls++; return []; } } as unknown as OutboxRelayRepository;
      await assert.rejects(new DomainEventOutboxRelay(repo, { publish: async () => { calls++; } })
        .runIsolatedBatch(), /OUTBOX_RELAY_DISABLED/);
      assert.equal(calls, 0);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('preserves ID on enqueue failure, records only a safe code and never marks success', async () => {
    const previous = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
    process.env.NODE_ENV = 'test'; process.env.APP_ENV = 'test';
    const claim: OutboxClaim = { eventId: 'event-1', claimToken: 'claim-1', attempts: 1, event: { ...event, eventId: 'event-1' } };
    const deferred: unknown[][] = [];
    const repo: OutboxRelayRepository = {
      claimEligible: async () => [claim],
      markEnqueued: async () => { throw new Error('must not mark failed enqueue'); },
      defer: async (...args) => { deferred.push(args); return true; },
    };
    try {
      const result = await new DomainEventOutboxRelay(repo, { publish: async (input) => {
        assert.equal(input.eventId, 'event-1'); throw new Error('private token and recipient');
      } }).runIsolatedBatch();
      assert.equal(result.failed, 1);
      assert.deepEqual(deferred[0].slice(0, 3), ['event-1', 'claim-1', 'ENQUEUE_FAILED']);
      assert.equal(JSON.stringify(result).includes('private'), false);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('rejects malformed stored envelopes before invoking transport', async () => isolated(async () => {
    let calls = 0;
    const repo: OutboxRelayRepository = {
      claimEligible: async () => [{ eventId: 'event-1', claimToken: 'claim-1', attempts: 1, event: { ...event, eventVersion: 'v9' } }],
      markEnqueued: async () => { throw new Error('unexpected acknowledgment'); },
      defer: async (id, token, code) => { assert.equal(code, 'INVALID_ENVELOPE'); return true; },
    };
    const result = await new DomainEventOutboxRelay(repo, { publish: async () => { calls++; } }).runIsolatedBatch();
    assert.equal(calls, 0); assert.equal(result.failed, 1);
  }));

  it('leaves claim recovery to its lease when acknowledgment fails after enqueue', async () => isolated(async () => {
    const failure = new Error('crash after queue acceptance');
    let sends = 0;
    const repo: OutboxRelayRepository = {
      claimEligible: async () => [{ eventId: 'event-1', claimToken: 'claim-1', attempts: 1, event: { ...event, eventId: 'event-1' } }],
      markEnqueued: async () => { throw failure; },
      defer: async () => { throw new Error('must not change claim on ambiguous acknowledgment'); },
    };
    await assert.rejects(new DomainEventOutboxRelay(repo, { publish: async () => { sends++; } }).runIsolatedBatch(), (error: unknown) => error === failure);
    assert.equal(sends, 1);
  }));

  it('does not report queue acceptance when the lease owner became stale', async () => isolated(async () => {
    const repo: OutboxRelayRepository = {
      claimEligible: async () => [{ eventId: 'event-1', claimToken: 'stale', attempts: 1, event: { ...event, eventId: 'event-1' } }],
      markEnqueued: async () => false,
      defer: async () => false,
    };
    assert.deepEqual(await new DomainEventOutboxRelay(repo, { publish: async () => {} }).runIsolatedBatch(),
      { claimed: 1, enqueued: 0, failed: 0, lostClaims: 1 });
  }));

  it('opens an outage circuit and defers the remaining batch without consuming consumer attempts', async () => isolated(async () => {
    const claims: OutboxClaim[] = Array.from({ length: 3 }, (_, index) => ({
      eventId: `event-${index}`, claimToken: `claim-${index}`, attempts: 1, event: { ...event, eventId: `event-${index}` },
    }));
    let claimCalls = 0;
    const deferred: string[] = [];
    const repo: OutboxRelayRepository = {
      claimEligible: async () => { claimCalls += 1; return claims; },
      markEnqueued: async () => { throw new Error('outage cannot be acknowledged'); },
      defer: async (id, _token, code) => { assert.equal(code, 'REDIS_OUTAGE'); deferred.push(id); return true; },
    };
    let publishes = 0;
    const relay = new DomainEventOutboxRelay(repo, { publish: async () => {
      publishes += 1;
      throw new DomainEventEnqueueOutcomeUnknownError();
    } });
    const first = await relay.runIsolatedBatch({ batchSize: 3 });
    assert.deepEqual(first, { claimed: 3, enqueued: 0, failed: 3, lostClaims: 0 });
    assert.equal(publishes, 1);
    assert.equal(claimCalls, 1);
    assert.equal(deferred.length, 3);
    assert.deepEqual(await relay.runIsolatedBatch({ batchSize: 3 }),
      { claimed: 0, enqueued: 0, failed: 0, lostClaims: 0 });
    assert.equal(claimCalls, 1);
  }));
});
