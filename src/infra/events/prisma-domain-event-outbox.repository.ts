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
          AND NOT EXISTS (
            SELECT 1 FROM domain_event_parking AS p
            WHERE p.event_id = domain_event_outbox.event_id AND p.status = 'parked'
          )
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

  async listEnqueuedForReconciliation(limit: number, after?: { createdAt: Date; eventId: string }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid reconciliation batch size');
    return this.prisma.domainEventOutbox.findMany({
      where: {
        eligibility: 'eligible', state: 'enqueued',
        ...(after ? { OR: [
          { createdAt: { gt: after.createdAt } },
          { createdAt: after.createdAt, eventId: { gt: after.eventId } },
        ] } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { eventId: 'asc' }],
      take: limit,
      select: {
        eventId: true, eventName: true, eventVersion: true, payload: true, occurredAt: true, correlationId: true, createdAt: true,
      },
    });
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
    if (!['INVALID_ENVELOPE', 'ENQUEUE_FAILED', 'REDIS_OUTAGE', 'ENQUEUE_OUTCOME_UNKNOWN'].includes(errorCode) ||
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

  async parkTerminal(
    eventId: string, claimToken: string,
    errorCategory: 'INVALID_ENVELOPE' | 'UNSUPPORTED_VERSION',
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ event_id: string; event_name: string; attempts: number }>>(Prisma.sql`
        SELECT event_id, event_name, attempts FROM domain_event_outbox
        WHERE event_id = ${eventId}::uuid AND eligibility = 'eligible' AND state = 'claimed'
          AND claim_token = ${claimToken}::uuid AND lease_until > clock_timestamp()
        FOR UPDATE
      `);
      if (!row) return false;
      await tx.domainEventParking.upsert({
        where: { eventId_consumerKey: { eventId, consumerKey: 'domain-event-routing.v1' } },
        create: {
          id: uuidv7(), eventId, consumerKey: 'domain-event-routing.v1', eventName: row.event_name,
          failureClass: 'terminal', errorCategory, businessAttempts: Math.max(1, row.attempts),
        },
        update: {
          failureClass: 'terminal', errorCategory,
          businessAttempts: { increment: 1 }, status: 'parked',
          lastFailedAt: new Date(), replayClaimToken: null, replayLeaseUntil: null,
        },
      });
      const updated = await tx.domainEventOutbox.updateMany({
        where: { eventId, eligibility: 'eligible', state: 'claimed', claimToken },
        data: { state: 'pending', claimToken: null, leaseUntil: null, lastErrorCode: errorCategory },
      });
      return updated.count === 1;
    });
  }
}
