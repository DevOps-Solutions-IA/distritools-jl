import {
  DomainEventName,
  DOMAIN_EVENT_CONTRACTS,
  VersionedDomainEvent,
  validateDomainEvent,
} from 'src/common/events/domain-event.contracts';

export type DomainEventHandler = (event: VersionedDomainEvent) => Promise<void> | void;

export class MissingDomainEventHandlerError extends Error {
  constructor(readonly eventName: string) {
    super(`No handler registered for domain event: ${eventName}`);
    this.name = 'MissingDomainEventHandlerError';
  }
}

export class DuplicateDomainEventHandlerError extends Error {
  constructor(readonly eventName: string, readonly consumerName: string) {
    super(`Handler already registered for ${eventName} by ${consumerName}`);
    this.name = 'DuplicateDomainEventHandlerError';
  }
}

export class DomainEventHandlerRegistry {
  private readonly handlers = new Map<string, Map<string, DomainEventHandler>>();

  register(eventName: DomainEventName, consumerName: string, handler: DomainEventHandler): void {
    const contract = DOMAIN_EVENT_CONTRACTS[eventName];
    if (!contract.publishable) {
      throw new Error(`Cannot register a handler for non-publishable event: ${eventName}`);
    }
    if (!consumerName.trim()) throw new Error('consumerName is required');

    const eventHandlers = this.handlers.get(eventName) ?? new Map<string, DomainEventHandler>();
    if (eventHandlers.has(consumerName)) {
      throw new DuplicateDomainEventHandlerError(eventName, consumerName);
    }
    eventHandlers.set(consumerName, handler);
    this.handlers.set(eventName, eventHandlers);
  }

  async dispatch(input: unknown): Promise<void> {
    const event = validateDomainEvent(input, { requireEventId: true });
    const eventHandlers = this.handlers.get(event.eventName);
    if (!eventHandlers?.size) throw new MissingDomainEventHandlerError(event.eventName);

    for (const handler of eventHandlers.values()) await handler(event);
  }
}
