import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { QueueNotificationsFromEventUseCase } from 'src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case';

@Injectable()
export class NotificationsEventSubscriber implements OnModuleInit {
  private readonly subscribedEvents = [
    'order.created',
    'order.cancelled',
    'order.paid',
    'payment.approved',
    'payment.rejected',
    'payment.expired',
    'inventory.low_stock_detected',
  ];

  constructor(
    @Inject(InMemoryDomainEventPublisher)
    private readonly eventPublisher: InMemoryDomainEventPublisher,
    @Inject(QueueNotificationsFromEventUseCase)
    private readonly queueNotificationsFromEventUseCase: QueueNotificationsFromEventUseCase,
  ) {}

  onModuleInit(): void {
    for (const eventName of this.subscribedEvents) {
      this.eventPublisher.subscribe(eventName, (event) =>
        this.queueNotificationsFromEventUseCase.execute(
          event as DomainEvent<Record<string, unknown>>,
        ),
      );
    }
  }
}
