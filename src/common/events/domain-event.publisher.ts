export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId?: string;
  eventName: string;
  eventVersion: string;
  payload: TPayload;
  occurredAt: string;
  correlationId?: string;
}

export interface DomainEventPublisher {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}

export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');
