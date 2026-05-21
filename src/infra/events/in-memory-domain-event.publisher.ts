import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { v7 as uuidv7 } from 'uuid';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEvent,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { BullMqDomainEventPublisher } from 'src/infra/events/bullmq-domain-event.publisher';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';

type DomainEventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => Promise<void> | void;

@Injectable()
export class InMemoryDomainEventPublisher
  implements DomainEventPublisher, OnModuleDestroy
{
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(InMemoryDomainEventPublisher.name);

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const enrichedEvent: DomainEvent<TPayload> = {
      ...event,
      eventId: event.eventId ?? uuidv7(),
    };

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
          (listener as DomainEventHandler<TPayload>)(enrichedEvent),
        ),
      ),
    );
  }

  subscribe<TPayload>(
    eventName: string,
    handler: DomainEventHandler<TPayload>,
  ): () => void {
    this.emitter.on(eventName, handler as DomainEventHandler);

    return () => {
      this.emitter.off(eventName, handler as DomainEventHandler);
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
    DomainEventsWorker,
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useExisting: InMemoryDomainEventPublisher,
    },
  ],
  exports: [InMemoryDomainEventPublisher, BullMqDomainEventPublisher, DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}

export { InMemoryDomainEventPublisher as DomainEventDispatcher };
