import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { v7 as uuidv7 } from 'uuid';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEvent,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { DomainEventName, VersionedDomainEvent, validateDomainEvent } from 'src/common/events/domain-event.contracts';
import { BullMqDomainEventPublisher } from 'src/infra/events/bullmq-domain-event.publisher';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY } from 'src/common/events/domain-event-outbox.port';
import { PrismaDomainEventOutboxRepository } from 'src/infra/events/prisma-domain-event-outbox.repository';

type DomainEventHandler = (event: DomainEvent<Record<string, unknown>>) => Promise<void> | void;

@Injectable()
export class InMemoryDomainEventPublisher
  implements DomainEventPublisher, OnModuleDestroy
{
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(InMemoryDomainEventPublisher.name);

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async publish(event: VersionedDomainEvent): Promise<void> {
    const validatedEvent = validateDomainEvent(event);
    const enrichedEvent: VersionedDomainEvent = { ...validatedEvent, eventId: validatedEvent.eventId ?? uuidv7() } as VersionedDomainEvent;

    this.logger.log(
      JSON.stringify({
        eventId: enrichedEvent.eventId,
        eventName: enrichedEvent.eventName,
        eventVersion: enrichedEvent.eventVersion,
        occurredAt: enrichedEvent.occurredAt,
        correlationId: enrichedEvent.correlationId,
      }),
    );
    const listeners = this.emitter.listeners(enrichedEvent.eventName);

    await Promise.all(
      listeners.map((listener) =>
        Promise.resolve(
        (listener as DomainEventHandler)(enrichedEvent),
        ),
      ),
    );
  }

  subscribe<TPayload>(
    eventName: DomainEventName,
    handler: DomainEventHandler,
  ): () => void {
    this.emitter.on(eventName, handler);

    return () => {
      this.emitter.off(eventName, handler);
    };
  }

  onModuleDestroy(): void {
    this.emitter.removeAllListeners();
  }
}

@Global()
@Module({
  providers: [
    InMemoryDomainEventPublisher,
    BullMqDomainEventPublisher,
    DomainEventHandlerRegistry,
    DomainEventsWorker,
    PrismaDomainEventOutboxRepository,
    { provide: DOMAIN_EVENT_OUTBOX_REPOSITORY, useExisting: PrismaDomainEventOutboxRepository },
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useExisting: InMemoryDomainEventPublisher,
    },
  ],
  exports: [
    InMemoryDomainEventPublisher,
    BullMqDomainEventPublisher,
    DomainEventHandlerRegistry,
    DOMAIN_EVENT_PUBLISHER,
    DOMAIN_EVENT_OUTBOX_REPOSITORY,
  ],
})
export class DomainEventsModule {}

export { InMemoryDomainEventPublisher as DomainEventDispatcher };
