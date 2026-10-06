import { Inject, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { validateDomainEvent } from 'src/common/events/domain-event.contracts';

@Processor('domain-events')
@Injectable()
export class DomainEventsWorker extends WorkerHost {
  constructor(
    @Inject(DomainEventHandlerRegistry)
    private readonly handlerRegistry: DomainEventHandlerRegistry,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const event = validateDomainEvent(job.data, { requireEventId: true });
    await this.handlerRegistry.dispatch(event);
  }
}
