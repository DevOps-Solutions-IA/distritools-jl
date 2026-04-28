import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  EMAIL_PROVIDER_PORT,
  EmailProviderPort,
} from 'src/modules/notifications/application/ports/email-provider.port';
import {
  WHATSAPP_PROVIDER_PORT,
  WhatsAppProviderPort,
} from 'src/modules/notifications/application/ports/whatsapp-provider.port';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from 'src/modules/notifications/domain/repositories/notification.repository';

@Injectable()
export class SendNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(EMAIL_PROVIDER_PORT)
    private readonly emailProvider: EmailProviderPort,
    @Inject(WHATSAPP_PROVIDER_PORT)
    private readonly whatsAppProvider: WhatsAppProviderPort,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(notificationId: string) {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    try {
      const providerMessageId = await this.dispatch(notification.channel, {
        recipient: notification.recipient,
        subject: notification.subject,
        content: notification.content,
      });

      const updated = await this.notificationRepository.markSent(
        notification.id,
        providerMessageId,
      );

      await this.auditRepository.write({
        action: 'notification.sent',
        entityType: 'notification',
        entityId: updated.id,
        afterData: updated,
        correlationId: updated.eventId,
      });

      return updated;
    } catch (error) {
      const updated = await this.notificationRepository.markFailed(
        notification.id,
        error instanceof Error ? error.message : 'Unknown notification error',
      );

      await this.auditRepository.write({
        action: 'notification.failed',
        entityType: 'notification',
        entityId: updated.id,
        afterData: updated,
        correlationId: updated.eventId,
      });

      throw error;
    }
  }

  private async dispatch(
    channel: NotificationChannel,
    input: {
      recipient: string;
      subject: string | null;
      content: string;
    },
  ): Promise<string> {
    switch (channel) {
      case 'email': {
        const result = await this.emailProvider.send({
          to: input.recipient,
          subject: input.subject ?? 'Notificación DistriTools JL',
          content: input.content,
        });

        return result.providerMessageId;
      }
      case 'whatsapp': {
        const result = await this.whatsAppProvider.send({
          to: input.recipient,
          content: input.content,
        });

        return result.providerMessageId;
      }
      case 'internal':
        return `internal-${notificationIdLike(input.recipient, input.content)}`;
    }

    throw new Error(`Unsupported notification channel: ${String(channel)}`);
  }
}

function notificationIdLike(recipient: string, content: string): string {
  return Buffer.from(`${recipient}:${content}`).toString('base64url').slice(0, 24);
}
