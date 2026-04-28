import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from 'src/modules/notifications/domain/repositories/notification.repository';
import { NotificationTemplateService } from 'src/modules/notifications/domain/services/notification-template.service';
import { NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';

@Injectable()
export class QueueNotificationsFromEventUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(NotificationTemplateService)
    private readonly templateService: NotificationTemplateService,
    @InjectQueue(NOTIFICATIONS_QUEUE_NAME)
    private readonly notificationsQueue: Queue,
  ) {}

  async execute(event: DomainEvent<Record<string, unknown>>) {
    const templates = this.templateService.resolveTemplates(event);

    for (const template of templates) {
      const creation = await this.notificationRepository.createIfAbsent({
        id: uuidv7(),
        eventId: event.eventId!,
        eventName: event.eventName,
        channel: template.channel,
        recipient: template.recipient,
        subject: template.subject ?? null,
        content: template.content,
        provider: template.provider,
        payload: event.payload,
      });

      if (!creation.inserted) {
        continue;
      }

      await this.notificationsQueue.add(
        'send-notification',
        {
          notificationId: creation.notification.id,
        },
        {
          jobId: creation.notification.id,
          attempts: 3,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );

      await this.auditRepository.write({
        action: 'notification.queued',
        entityType: 'notification',
        entityId: creation.notification.id,
        afterData: creation.notification,
        correlationId: event.eventId,
      });
    }
  }
}
