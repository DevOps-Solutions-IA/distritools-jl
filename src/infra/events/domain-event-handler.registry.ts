import {
  DomainEventName,
  DOMAIN_EVENT_CONTRACTS,
  VersionedDomainEvent,
  validateDomainEvent,
} from 'src/common/events/domain-event.contracts';
import { requiredConsumerKeys } from 'src/infra/events/domain-event-replay-policy';

export type DomainEventHandler = (event: VersionedDomainEvent) => Promise<void> | void;

export class MissingDomainEventHandlerError extends Error {
  readonly consumerKey = 'domain-event-routing.v1';
  constructor(readonly eventName: string) {
    super(`No handler registered for domain event: ${eventName}`);
    this.name = 'MissingDomainEventHandlerError';
  }
}

export class MissingRequiredDomainEventConsumersError extends Error {
  readonly consumerKey = 'domain-event-routing.v1';
  constructor(readonly eventName: string, readonly missingConsumers: string[]) {
    super(`Required consumers are not registered for ${eventName}`);
    this.name = 'MissingRequiredDomainEventConsumersError';
  }
}

const FAILURE_CONSUMERS = new WeakMap<object, { consumerKey: string; eventName: string }>();

export function domainEventFailureConsumer(error: unknown): { consumerKey: string; eventName: string } | undefined {
  return error !== null && (typeof error === 'object' || typeof error === 'function')
    ? FAILURE_CONSUMERS.get(error as object)
    : undefined;
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
    const required = requiredConsumerKeys(DOMAIN_EVENT_CONTRACTS[event.eventName].inMemoryConsumers);
    const eventHandlers = this.handlers.get(event.eventName);
    const registered = [...(eventHandlers?.keys() ?? [])];
    const missing = required.filter((consumerKey) => !registered.includes(consumerKey));
    if (missing.length) throw new MissingRequiredDomainEventConsumersError(event.eventName, missing);
    if (!eventHandlers?.size) throw new MissingDomainEventHandlerError(event.eventName);

    for (const [consumerKey, handler] of eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
          FAILURE_CONSUMERS.set(error as object, { consumerKey, eventName: event.eventName });
        }
        throw error;
      }
    }
  }

  consumerKeys(eventName: DomainEventName): string[] {
    return [...(this.handlers.get(eventName)?.keys() ?? [])];
  }
}
