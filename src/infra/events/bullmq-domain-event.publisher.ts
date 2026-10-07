import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import { DomainEventPublisher, VersionedDomainEvent } from 'src/common/events/domain-event.publisher';
import { validateDomainEvent } from 'src/common/events/domain-event.contracts';

const DOMAIN_EVENTS_QUEUE = 'domain-events';
const ENQUEUE_DEADLINE_MS = 5_000;

export class DomainEventEnqueueOutcomeUnknownError extends Error {
  readonly code = 'ENQUEUE_OUTCOME_UNKNOWN';

  constructor() {
    super('Domain event enqueue outcome is unknown; retry with the original event ID');
    this.name = 'DomainEventEnqueueOutcomeUnknownError';
  }
}

@Injectable()
export class BullMqDomainEventPublisher implements DomainEventPublisher, OnModuleDestroy {
  private readonly logger = new Logger(BullMqDomainEventPublisher.name);

  constructor(
    @InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly queue: Queue,
    private readonly enqueueDeadlineMs = ENQUEUE_DEADLINE_MS,
  ) {}

  async publish(event: VersionedDomainEvent): Promise<void> {
    const validatedEvent = validateDomainEvent(event);
    const eventId = validatedEvent.eventId ?? uuidv7();

    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.queue.add(validatedEvent.eventName, {
        eventId,
        eventName: validatedEvent.eventName,
        eventVersion: validatedEvent.eventVersion,
        payload: validatedEvent.payload,
        occurredAt: validatedEvent.occurredAt,
        correlationId: validatedEvent.correlationId,
        }, {
          jobId: eventId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000, jitter: 0.5 },
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
          removeOnFail: false,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DomainEventEnqueueOutcomeUnknownError()), this.enqueueDeadlineMs);
        }),
      ]);
    } catch (error) {
      this.logger.warn(JSON.stringify({
        eventId,
        category: 'ENQUEUE_OUTCOME_UNKNOWN',
      }));
      throw error instanceof DomainEventEnqueueOutcomeUnknownError ? error : new DomainEventEnqueueOutcomeUnknownError();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  onModuleDestroy(): void {
    this.queue.close().catch(() => undefined);
  }
}

export { DOMAIN_EVENTS_QUEUE };
