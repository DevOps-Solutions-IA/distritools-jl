import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';
import { NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';
import { boundedWorkerShutdown } from 'src/infra/queue/bounded-worker-shutdown';

@Processor({ name: NOTIFICATIONS_QUEUE_NAME, configKey: 'domainWorker' })
export class NotificationsProcessor extends WorkerHost implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsProcessor.name);
  constructor(
    @Inject(SendNotificationUseCase)
    private readonly sendNotificationUseCase: SendNotificationUseCase,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    await this.sendNotificationUseCase.execute(job.data.notificationId);
  }

  async onApplicationShutdown(): Promise<void> {
    const result = await boundedWorkerShutdown(this.worker);
    if (!result.drained) {
      this.logger.warn(JSON.stringify({ category: 'WORKER_SHUTDOWN_DEADLINE', action: 'leave_notification_recoverable' }));
    }
  }
}
