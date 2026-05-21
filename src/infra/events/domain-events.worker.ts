import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

interface DomainEventJob {
  eventId: string;
  eventName: string;
  eventVersion: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  correlationId?: string;
}

type EventHandler = (event: DomainEventJob) => Promise<void>;

@Processor('domain-events')
@Injectable()
export class DomainEventsWorker extends WorkerHost {
  private readonly logger = new Logger(DomainEventsWorker.name);
  private readonly handlers = new Map<string, EventHandler>();

  registerHandler(eventName: string, handler: EventHandler): void {
    this.handlers.set(eventName, handler);
  }

  async process(job: Job<DomainEventJob>): Promise<void> {
    const event = job.data;
    const handler = this.handlers.get(event.eventName);

    if (!handler) {
      this.logger.warn(`No handler registered for event: ${event.eventName}`);
      return;
    }

    try {
      await handler(event);
    } catch (error) {
      this.logger.error(
        `Handler failed for event ${event.eventName} (${event.eventId})`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
