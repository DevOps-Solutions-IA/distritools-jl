import type { VersionedDomainEvent } from 'src/common/events/domain-event.contracts';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export const DOMAIN_EVENT_OUTBOX_REPOSITORY = Symbol('DOMAIN_EVENT_OUTBOX_REPOSITORY');
export type PersistedDomainEvent = VersionedDomainEvent & { eventId: string };

export interface DomainEventOutboxRepository {
  captureHeld(tx: PrismaTransactionClient, event: VersionedDomainEvent): Promise<PersistedDomainEvent>;
}

export interface OutboxClaim {
  eventId: string;
  claimToken: string;
  attempts: number;
  event: unknown;
}

export interface OutboxRelayRepository {
  claimEligible(limit: number, leaseMs: number): Promise<OutboxClaim[]>;
  markEnqueued(eventId: string, claimToken: string): Promise<boolean>;
  defer(eventId: string, claimToken: string, errorCode: string, delayMs: number): Promise<boolean>;
}
