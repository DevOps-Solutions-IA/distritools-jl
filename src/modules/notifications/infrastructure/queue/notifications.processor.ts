import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';
import { NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';

@Processor(NOTIFICATIONS_QUEUE_NAME)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    @Inject(SendNotificationUseCase)
    private readonly sendNotificationUseCase: SendNotificationUseCase,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    await this.sendNotificationUseCase.execute(job.data.notificationId);
  }
}
