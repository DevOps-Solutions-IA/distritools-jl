import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { validateDomainEvent, VersionedDomainEvent } from 'src/common/events/domain-event.contracts';
import type { DomainEventOutboxRepository, OutboxClaim, OutboxRelayRepository, PersistedDomainEvent } from 'src/common/events/domain-event-outbox.port';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaDomainEventOutboxRepository implements DomainEventOutboxRepository, OutboxRelayRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async captureHeld(tx: PrismaTransactionClient, input: VersionedDomainEvent): Promise<PersistedDomainEvent> {
    const event = validateDomainEvent({ ...input, eventId: input.eventId ?? uuidv7() }, { requireEventId: true });
    await tx.domainEventOutbox.create({ data: {
      eventId: event.eventId!, eventName: event.eventName, eventVersion: event.eventVersion,
      payload: JSON.parse(JSON.stringify(event.payload)) as Prisma.InputJsonValue,
      occurredAt: new Date(event.occurredAt), correlationId: event.correlationId,
      eligibility: 'held', holdReason: 'legacy_delivery_requires_reconciliation', state: 'pending',
    } });
    return event as PersistedDomainEvent;
  }

  async claimEligible(limit: number, leaseMs: number): Promise<OutboxClaim[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) {
      throw new Error('Invalid outbox batch or lease bounds');
    }
    const token = uuidv7();
    // One statement claims disjoint rows. Redis work happens only after this statement commits.
    const rows = await this.prisma.$queryRaw<Array<{
      event_id: string; event_name: string; event_version: string; payload: unknown;
      occurred_at: Date; correlation_id: string | null; attempts: number;
    }>>(Prisma.sql`
      WITH candidates AS (
        SELECT event_id FROM domain_event_outbox
        WHERE eligibility = 'eligible' AND next_attempt_at <= clock_timestamp()
          AND (state = 'pending' OR (state = 'claimed' AND lease_until <= clock_timestamp()))
        ORDER BY created_at, event_id LIMIT ${limit} FOR UPDATE SKIP LOCKED
      )
      UPDATE domain_event_outbox AS o SET state = 'claimed', claim_token = ${token}::uuid,
        lease_until = clock_timestamp() + ${leaseMs} * interval '1 millisecond', attempts = attempts + 1
      FROM candidates AS c WHERE o.event_id = c.event_id RETURNING o.*
    `);
    return rows.map((row) => ({
      eventId: row.event_id, claimToken: token, attempts: row.attempts,
      event: { eventId: row.event_id, eventName: row.event_name, eventVersion: row.event_version,
        payload: row.payload, occurredAt: row.occurred_at.toISOString(),
        ...(row.correlation_id === null ? {} : { correlationId: row.correlation_id }) },
    }));
  }

  async markEnqueued(eventId: string, claimToken: string): Promise<boolean> {
    const changed = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE domain_event_outbox SET state = 'enqueued', enqueued_at = clock_timestamp(),
        claim_token = NULL, lease_until = NULL, last_error_code = NULL
      WHERE event_id = ${eventId}::uuid AND eligibility = 'eligible' AND state = 'claimed'
        AND claim_token = ${claimToken}::uuid AND lease_until > clock_timestamp()
    `);
    return changed === 1;
  }

  async defer(eventId: string, claimToken: string, errorCode: string, delayMs: number): Promise<boolean> {
    if (!['INVALID_ENVELOPE', 'ENQUEUE_FAILED'].includes(errorCode) ||
        !Number.isInteger(delayMs) || delayMs < 1000 || delayMs > 60000) {
      throw new Error('Invalid outbox retry metadata');
    }
    const changed = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE domain_event_outbox SET state = 'pending', claim_token = NULL, lease_until = NULL,
        last_error_code = ${errorCode}, next_attempt_at = clock_timestamp() + ${delayMs} * interval '1 millisecond'
      WHERE event_id = ${eventId}::uuid AND eligibility = 'eligible' AND state = 'claimed'
        AND claim_token = ${claimToken}::uuid AND lease_until > clock_timestamp()
    `);
    return changed === 1;
  }
}
