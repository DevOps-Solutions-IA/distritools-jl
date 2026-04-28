import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from 'src/modules/auth/auth.module';
import {
  EMAIL_PROVIDER_PORT,
} from 'src/modules/notifications/application/ports/email-provider.port';
import {
  WHATSAPP_PROVIDER_PORT,
} from 'src/modules/notifications/application/ports/whatsapp-provider.port';
import { ListNotificationsUseCase } from 'src/modules/notifications/application/use-cases/list-notifications.use-case';
import { QueueNotificationsFromEventUseCase } from 'src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';
import {
  NOTIFICATION_REPOSITORY,
} from 'src/modules/notifications/domain/repositories/notification.repository';
import { NotificationTemplateService } from 'src/modules/notifications/domain/services/notification-template.service';
import { NotificationsController } from 'src/modules/notifications/infrastructure/http/controllers/notifications.controller';
import { MockEmailProvider } from 'src/modules/notifications/infrastructure/providers/mock-email.provider';
import { MockWhatsAppProvider } from 'src/modules/notifications/infrastructure/providers/mock-whatsapp.provider';
import { NotificationsEventSubscriber } from 'src/modules/notifications/infrastructure/queue/notifications-event.subscriber';
import { NotificationsProcessor } from 'src/modules/notifications/infrastructure/queue/notifications.processor';
import { NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';
import { PrismaNotificationRepository } from 'src/modules/notifications/infrastructure/repositories/prisma-notification.repository';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE_NAME,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationTemplateService,
    ListNotificationsUseCase,
    QueueNotificationsFromEventUseCase,
    SendNotificationUseCase,
    PrismaNotificationRepository,
    MockEmailProvider,
    MockWhatsAppProvider,
    NotificationsEventSubscriber,
    NotificationsProcessor,
    {
      provide: NOTIFICATION_REPOSITORY,
      useExisting: PrismaNotificationRepository,
    },
    {
      provide: EMAIL_PROVIDER_PORT,
      useExisting: MockEmailProvider,
    },
    {
      provide: WHATSAPP_PROVIDER_PORT,
      useExisting: MockWhatsAppProvider,
    },
  ],
  exports: [NOTIFICATION_REPOSITORY],
})
export class NotificationsModule {}
