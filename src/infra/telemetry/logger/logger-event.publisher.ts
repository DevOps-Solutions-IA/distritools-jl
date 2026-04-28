import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEvent,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';

@Injectable()
export class LoggerEventPublisher implements DomainEventPublisher {
  private readonly logger = new Logger(LoggerEventPublisher.name);

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    this.logger.log(JSON.stringify(event));
  }
}
