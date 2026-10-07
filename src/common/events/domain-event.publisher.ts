import type { VersionedDomainEvent } from 'src/common/events/domain-event.contracts';
import type { DomainEventRoute } from 'src/infra/events/domain-event-routing.policy';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId?: string;
  eventName: string;
  eventVersion: string;
  payload: TPayload;
  occurredAt: string;
  correlationId?: string;
}

export type { VersionedDomainEvent } from 'src/common/events/domain-event.contracts';

export interface DomainEventPublisher {
  publish(event: VersionedDomainEvent, persistedRoute?: DomainEventRoute): Promise<void>;
}

export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');
