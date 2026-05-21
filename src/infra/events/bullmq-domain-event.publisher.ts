import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import { DomainEvent, DomainEventPublisher } from 'src/common/events/domain-event.publisher';

const DOMAIN_EVENTS_QUEUE = 'domain-events';

@Injectable()
export class BullMqDomainEventPublisher implements DomainEventPublisher, OnModuleDestroy {
  private readonly logger = new Logger(BullMqDomainEventPublisher.name);

  constructor(@InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly queue: Queue) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const eventId = event.eventId ?? uuidv7();

    try {
      await this.queue.add(event.eventName, {
        eventId,
        eventName: event.eventName,
        eventVersion: event.eventVersion,
        payload: event.payload,
        occurredAt: event.occurredAt,
        correlationId: event.correlationId,
      }, {
        jobId: eventId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (error) {
      this.logger.error(`Failed to publish domain event ${event.eventName}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.queue.close().catch(() => undefined);
  }
}

export { DOMAIN_EVENTS_QUEUE };
