import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import { DomainEventPublisher, VersionedDomainEvent } from 'src/common/events/domain-event.publisher';
import { validateDomainEvent } from 'src/common/events/domain-event.contracts';

const DOMAIN_EVENTS_QUEUE = 'domain-events';

@Injectable()
export class BullMqDomainEventPublisher implements DomainEventPublisher, OnModuleDestroy {
  private readonly logger = new Logger(BullMqDomainEventPublisher.name);

  constructor(@InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly queue: Queue) {}

  async publish(event: VersionedDomainEvent): Promise<void> {
    const validatedEvent = validateDomainEvent(event);
    const eventId = validatedEvent.eventId ?? uuidv7();

    try {
      await this.queue.add(validatedEvent.eventName, {
        eventId,
        eventName: validatedEvent.eventName,
        eventVersion: validatedEvent.eventVersion,
        payload: validatedEvent.payload,
        occurredAt: validatedEvent.occurredAt,
        correlationId: validatedEvent.correlationId,
      }, {
        jobId: eventId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.error(`Failed to publish domain event ${validatedEvent.eventName}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.queue.close().catch(() => undefined);
  }
}

export { DOMAIN_EVENTS_QUEUE };
