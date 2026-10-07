import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { QueueNotificationsFromEventUseCase } from 'src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case';

export const NOTIFICATION_DOMAIN_EVENT_NAMES = [
  'order.created', 'order.cancelled', 'order.paid', 'payment.approved', 'payment.rejected', 'payment.expired',
  'shipment.quote_created', 'shipment.carrier_selected', 'shipment.guide_created', 'shipment.auto_shipping_failed',
  'inventory.low_stock_detected',
] as const;

const DURABLE_NOTIFICATION_EVENT_NAMES = NOTIFICATION_DOMAIN_EVENT_NAMES.filter(
  (eventName) => eventName !== 'inventory.low_stock_detected' && eventName !== 'order.paid',
);

@Injectable()
export class NotificationsEventSubscriber implements OnModuleInit {
  constructor(
    @Inject(InMemoryDomainEventPublisher) private readonly eventPublisher: InMemoryDomainEventPublisher,
    @Inject(QueueNotificationsFromEventUseCase) private readonly notifications: QueueNotificationsFromEventUseCase,
    @Inject(DomainEventHandlerRegistry) private readonly handlers: DomainEventHandlerRegistry,
  ) {}

  onModuleInit(): void {
    for (const eventName of NOTIFICATION_DOMAIN_EVENT_NAMES) {
      if (eventName === 'order.paid') {
        // Preserve the legacy known-gap behavior without claiming a durable consumer exists.
        this.eventPublisher.subscribe(eventName, () => undefined);
        continue;
      }
      const handler = (event: DomainEvent<Record<string, unknown>>) => this.notifications.execute(event);
      if ((DURABLE_NOTIFICATION_EVENT_NAMES as readonly string[]).includes(eventName)) {
        this.handlers.register(eventName as (typeof DURABLE_NOTIFICATION_EVENT_NAMES)[number], 'notifications.v1', handler as never);
      }
      this.eventPublisher.subscribe(eventName, handler);
    }
  }
}
