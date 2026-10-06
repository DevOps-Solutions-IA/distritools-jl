import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { QueueNotificationsFromEventUseCase } from 'src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case';

export const NOTIFICATION_DOMAIN_EVENT_NAMES = [
  'order.created',
  'order.cancelled',
  'order.paid',
  'payment.approved',
  'payment.rejected',
  'payment.expired',
  'shipment.quote_created',
  'shipment.carrier_selected',
  'shipment.guide_created',
  'shipment.auto_shipping_failed',
  'inventory.low_stock_detected',
] as const;

@Injectable()
export class NotificationsEventSubscriber implements OnModuleInit {
  constructor(
    @Inject(InMemoryDomainEventPublisher)
    private readonly eventPublisher: InMemoryDomainEventPublisher,
    @Inject(QueueNotificationsFromEventUseCase)
    private readonly queueNotificationsFromEventUseCase: QueueNotificationsFromEventUseCase,
  ) {}

  onModuleInit(): void {
    for (const eventName of NOTIFICATION_DOMAIN_EVENT_NAMES) {
      this.eventPublisher.subscribe(eventName, (event) =>
        this.queueNotificationsFromEventUseCase.execute(
          event as DomainEvent<Record<string, unknown>>,
        ),
      );
    }
  }
}
