import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { NotificationTemplateService } from 'src/modules/notifications/domain/services/notification-template.service';
import { NotificationDispatchRecoveryService } from 'src/modules/notifications/infrastructure/queue/notification-dispatch-recovery.service';

@Injectable()
export class QueueNotificationsFromEventUseCase {
  constructor(
    @Inject(NotificationTemplateService) private readonly templateService: NotificationTemplateService,
    @Inject(PrismaDomainEventInboxRepository) private readonly inbox: PrismaDomainEventInboxRepository,
    @Inject(NotificationDispatchRecoveryService) private readonly dispatchRecovery: NotificationDispatchRecoveryService,
  ) {}

  async execute(event: DomainEvent<Record<string, unknown>>) {
    const templates = this.templateService.resolveTemplates(event);
    await this.inbox.runOnce('notifications.v1', event as never, async (tx) => {
      for (const template of templates) {
        const inserted = await tx.notification.createMany({
          data: [{
            id: uuidv7(), eventId: event.eventId!, eventName: event.eventName,
            channel: template.channel, recipient: template.recipient,
            subject: template.subject ?? null, content: template.content,
            provider: template.provider, payload: event.payload as never, dispatchEligible: true,
          }],
          skipDuplicates: true,
        });
        if (!inserted.count) continue;
        const notification = await tx.notification.findUniqueOrThrow({ where: {
          eventId_channel_recipient: { eventId: event.eventId!, channel: template.channel, recipient: template.recipient },
        } });
        await tx.notificationAuditIntent.createMany({ data: [{
          id: uuidv7(), notificationId: notification.id, transitionKey: 'queued',
          action: 'notification.queued', eventId: event.eventId!,
          afterData: { status: 'queued', dispatch: 'durable_intent' },
        }], skipDuplicates: true });
      }
    });

    // A completed inbox receipt does not suppress recovery of the committed notification intent.
    await this.dispatchRecovery.enqueueEvent(event.eventId!);
  }
}
