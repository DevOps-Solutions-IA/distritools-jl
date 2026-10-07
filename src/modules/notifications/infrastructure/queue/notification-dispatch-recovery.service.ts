import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_REPOSITORY, NotificationRepository } from 'src/modules/notifications/domain/repositories/notification.repository';
import { NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';

@Injectable()
export class NotificationDispatchRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatchRecoveryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => { void this.recoverBatch(); }, 20_000);
    this.timer.unref();
    void this.recoverBatch();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueueEvent(eventId: string): Promise<string[]> {
    return this.recoverBatch(eventId);
  }

  async recoverBatch(_eventId?: string): Promise<string[]> {
    const enqueued: string[] = [];
    try {
      await this.notifications.recoverExpiredSends(50);
      try { await this.notifications.flushAuditIntents(50); }
      catch { this.logger.warn('Notification audit recovery failed; dispatch remains eligible'); }
      const claims = await this.notifications.claimDispatchBatch(50, 30_000, _eventId);
      for (const claim of claims) {
        try {
          await this.queue.add('send-notification', { notificationId: claim.id }, {
            jobId: claim.id, attempts: 3, removeOnComplete: 50, removeOnFail: 50,
          });
          enqueued.push(claim.id);
        } catch {
          // Release every claimed row independently; one Redis failure must not strand the rest of the batch.
          this.logger.warn('Notification enqueue failed; durable intent remains recoverable');
        } finally {
          await this.notifications.releaseDispatchClaim(claim.id, claim.claimToken);
        }
      }
    } catch {
      // Durable queued rows remain discoverable; deliberately omit provider/recipient details.
      this.logger.warn('Notification dispatch recovery batch failed; queued intents remain recoverable');
    }
    return enqueued;
  }
}
