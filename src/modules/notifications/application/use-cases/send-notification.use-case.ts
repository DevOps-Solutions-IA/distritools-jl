import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
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
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';

@Injectable()
export class SendNotificationUseCase {
  private readonly logger = new Logger(SendNotificationUseCase.name);
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(EMAIL_PROVIDER_PORT)
    private readonly emailProvider: EmailProviderPort,
    @Inject(WHATSAPP_PROVIDER_PORT)
    private readonly whatsAppProvider: WhatsAppProviderPort,
  ) {}

  async execute(notificationId: string) {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.recoverAudit(notification.id);
    const claim = await this.notificationRepository.claimForSend(notification.id, 120_000);
    if (!claim) return this.notificationRepository.findById(notification.id);

    let providerMessageId: string;
    try {
      providerMessageId = await this.dispatch(notification.channel, {
        recipient: notification.recipient,
        subject: notification.subject,
        content: notification.content,
      });
    } catch (error) {
      if (error instanceof NotificationDeliveryError) {
        const finalized = await this.notificationRepository.markFailedWithClaim(notification.id, claim.claimToken, error.safeCode);
        await this.recoverAudit(notification.id);
        if (!finalized) return this.notificationRepository.findById(notification.id);
        throw error;
      }
      // A provider may have accepted the request before timing out; never blindly retry.
      await this.notificationRepository.markUncertainWithClaim(notification.id, claim.claimToken, 'PROVIDER_OUTCOME_UNCERTAIN');
      await this.recoverAudit(notification.id);
      return this.notificationRepository.findById(notification.id);
    }

    const finalized = await this.notificationRepository.markSentWithClaim(notification.id, claim.claimToken, providerMessageId);
    if (!finalized) return this.notificationRepository.findById(notification.id);
    const updated = await this.notificationRepository.findById(notification.id);
    if (!updated) throw new NotFoundException('Notification not found');
    await this.recoverAudit(notification.id);
    return updated;
  }

  private async recoverAudit(id: string) {
    try { await this.notificationRepository.flushAuditIntents(50, id); }
    catch { this.logger.warn('Notification audit intent remains recoverable'); }
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
