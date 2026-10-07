import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import type { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { VersionedDomainEvent } from 'src/common/events/domain-event.contracts';

const event: VersionedDomainEvent & { eventId: string } = {
  eventId: '0199a001-0000-7000-8000-000000000001',
  eventName: 'order.cancelled',
  eventVersion: 'v1',
  occurredAt: '2026-10-06T12:00:00.000Z',
  payload: {
    orderId: 'order-1', orderNumber: 'DT-1', status: 'cancelled',
    customerEmail: null, customerPhone: null,
  },
};

describe('durable domain event inbox', () => {
  it('commits effect and completion receipt through the same transaction', async () => {
    const calls: string[] = [];
    const receipt = {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push('create');
        assert.equal(data.consumerKey, 'notifications.v1');
        assert.equal(data.eventId, event.eventId);
        assert.match(String(data.envelopeHash), /^[a-f0-9]{64}$/);
        assert.equal(data.status, 'processing');
        return { id: data.id };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push('complete');
        assert.equal(data.status, 'completed');
      },
      findUnique: async () => null,
    };
    const prisma = {
      $transaction: async <T>(operation: (tx: unknown) => Promise<T>) => {
        calls.push('transaction');
        return operation({
          domainEventInbox: receipt,
          $queryRaw: async () => [],
        });
      },
      domainEventInbox: { findUnique: async () => null },
    };
    const repository = new PrismaDomainEventInboxRepository(prisma as unknown as PrismaService);

    const result = await repository.runOnce('notifications.v1', event, async (tx) => {
      calls.push('effect');
      assert.ok(tx);
      return 'effect-result';
    });

    assert.deepEqual(calls, ['transaction', 'create', 'effect', 'complete']);
    assert.deepEqual(result, { status: 'processed', value: 'effect-result' });
  });

  it('fails closed when an existing consumer/event identity has another envelope', async () => {
    const prisma = {
      $transaction: async () => {
        const error = Object.assign(new Error('unique'), { code: 'P2002' });
        throw error;
      },
      domainEventInbox: {
        findUnique: async () => ({
          consumerKey: 'notifications.v1', eventId: event.eventId,
          envelopeHash: '0'.repeat(64), status: 'completed',
        }),
      },
    };
    const repository = new PrismaDomainEventInboxRepository(prisma as unknown as PrismaService);
    let effects = 0;

    await assert.rejects(
      repository.runOnce('notifications.v1', event, async () => { effects += 1; }),
      /conflicting domain event replay/i,
    );
    assert.equal(effects, 0);
  });
});
