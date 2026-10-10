import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { NOTIFICATION_REPOSITORY, NotificationRepository } from 'src/modules/notifications/domain/repositories/notification.repository';
import { NOTIFICATION_MAX_DELIVERY_ATTEMPTS, NOTIFICATIONS_QUEUE_NAME } from 'src/modules/notifications/infrastructure/queue/notifications.queue.constants';

@Injectable()
export class NotificationDispatchRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatchRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private activeBatch?: Promise<string[]>;
  private stopping = false;
  private circuitUntil = 0;
  private outageCount = 0;

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue,
    @Optional() @Inject('NOTIFICATION_RECOVERY_SHUTDOWN_DEADLINE_MS') private readonly shutdownDeadlineMs = 5_000,
    @Optional() @Inject('NOTIFICATION_RECOVERY_OUTAGE_BASE_MS') private readonly outageBaseMs = 5_000,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => { void this.recoverBatch(); }, 20_000);
    this.timer.unref();
    void this.recoverBatch();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    if (!this.activeBatch) return;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.activeBatch,
        new Promise<void>((resolve) => { timer = setTimeout(resolve, this.shutdownDeadlineMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async enqueueEvent(eventId: string): Promise<string[]> {
    return this.recoverBatch(eventId);
  }

  async recoverBatch(_eventId?: string): Promise<string[]> {
    if (this.stopping) return [];
    if (this.activeBatch) return this.activeBatch;
    const operation = this.runRecoveryBatch(_eventId);
    this.activeBatch = operation;
    try {
      return await operation;
    } finally {
      if (this.activeBatch === operation) this.activeBatch = undefined;
    }
  }

  private async runRecoveryBatch(eventId?: string): Promise<string[]> {
    const enqueued: string[] = [];
    try {
      await this.notifications.recoverExpiredSends(50);
      try { await this.notifications.flushAuditIntents(50); }
      catch { this.logger.warn('Notification audit recovery failed; dispatch remains eligible'); }
      if (this.stopping || Date.now() < this.circuitUntil) return enqueued;
      const claims = await this.notifications.claimDispatchBatch(50, 30_000, eventId);
      for (let index = 0; index < claims.length; index += 1) {
        const claim = claims[index];
        if (this.stopping) {
          await this.releaseClaims(claims.slice(index));
          break;
        }
        try {
          const job = await this.enqueueOrRecover(claim.id);
          if (job) enqueued.push(claim.id);
        } catch {
          this.openCircuit();
          this.logger.warn(JSON.stringify({ category: 'REDIS_OUTAGE', action: 'release_batch_and_back_off' }));
          await this.releaseClaims(claims.slice(index + 1));
          break;
        } finally {
          await this.notifications.releaseDispatchClaim(claim.id, claim.claimToken);
        }
        this.outageCount = 0;
      }
    } catch {
      // Durable queued rows remain discoverable; deliberately omit provider/recipient details.
      this.logger.warn('Notification dispatch recovery batch failed; queued intents remain recoverable');
    }
    return enqueued;
  }

  private async enqueueOrRecover(notificationId: string): Promise<Job | null> {
    let job = await this.queue.getJob(notificationId);
    if (!job) {
      return this.queue.add('send-notification', { notificationId }, this.jobOptions(notificationId));
    }
    if (job.name !== 'send-notification' || job.data?.notificationId !== notificationId) {
      throw new Error('Notification queue job identity conflict');
    }

    const state = await job.getState();
    if (state === 'failed') {
      // PostgreSQL attempts are authoritative; this only reactivates the same transport identity.
      await job.retry('failed', { resetAttemptsMade: true });
      return job;
    }
    if (state === 'completed') {
      const notification = await this.notifications.findById(notificationId);
      if (!notification || !['queued', 'failed'].includes(notification.status) ||
        notification.attempts >= NOTIFICATION_MAX_DELIVERY_ATTEMPTS) return null;
      await job.remove();
      return this.queue.add('send-notification', { notificationId }, this.jobOptions(notificationId));
    }
    // Another batch may have released its lease after making this job executable.
    // Seeing that existing transport is not a new recovery by this batch.
    if (['waiting', 'active', 'delayed', 'waiting-children', 'prioritized'].includes(state)) return null;
    throw new Error('Notification queue job state cannot be recovered safely');
  }

  private jobOptions(notificationId: string) {
    return {
      jobId: notificationId,
      attempts: NOTIFICATION_MAX_DELIVERY_ATTEMPTS,
      backoff: { type: 'exponential' as const, delay: 2_000, jitter: 0.5 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
      removeOnFail: false,
    };
  }

  private async releaseClaims(claims: Array<{ id: string; claimToken: string }>): Promise<void> {
    for (const claim of claims) {
      try { await this.notifications.releaseDispatchClaim(claim.id, claim.claimToken); }
      catch { this.logger.warn('Notification dispatch claim remains recoverable by lease expiry'); }
    }
  }

  private openCircuit(): void {
    this.outageCount += 1;
    this.circuitUntil = Date.now() + Math.min(60_000, this.outageBaseMs * 2 ** Math.min(this.outageCount - 1, 4));
  }
}
