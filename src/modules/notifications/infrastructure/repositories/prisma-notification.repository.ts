import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import {
  NotificationRecord,
  NotificationRepository,
} from 'src/modules/notifications/domain/repositories/notification.repository';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private map(record: {
    id: string;
    eventId: string;
    eventName: string;
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    content: string;
    provider: string;
    status: NotificationStatus;
    providerMessageId: string | null;
    attempts: number;
    lastError: string | null;
    payload: unknown;
    sentAt: Date | null;
    failedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationRecord {
    return {
      id: record.id, eventId: record.eventId, eventName: record.eventName,
      channel: record.channel, recipient: record.recipient, subject: record.subject,
      content: record.content, provider: record.provider, status: record.status,
      providerMessageId: record.providerMessageId, attempts: record.attempts,
      lastError: record.lastError, payload: record.payload, sentAt: record.sentAt,
      failedAt: record.failedAt, createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }

  async findById(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    return notification ? this.map(notification) : null;
  }

  async list(limit = 50) {
    const records = await this.prisma.notification.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return records.map((record) => this.map(record));
  }

  async claimDispatchBatch(limit: number, leaseMs: number, eventId?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) {
      throw new Error('Invalid notification dispatch bounds');
    }
    const token = uuidv7();
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidates AS (
        SELECT id FROM notifications WHERE dispatch_eligible = true AND status = 'queued'
          AND (${eventId ?? null}::text IS NULL OR event_id = ${eventId ?? null})
          AND (dispatch_lease_until IS NULL OR dispatch_lease_until <= clock_timestamp())
        ORDER BY created_at, id LIMIT ${limit} FOR UPDATE SKIP LOCKED
      )
      UPDATE notifications n SET dispatch_claim_token = ${token}::uuid,
        updated_at = clock_timestamp(),
        dispatch_lease_until = clock_timestamp() + ${leaseMs} * interval '1 millisecond'
      FROM candidates c WHERE n.id = c.id RETURNING n.id
    `);
    return rows.map(({ id }) => ({ id, claimToken: token }));
  }

  async releaseDispatchClaim(id: string, claimToken: string) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE notifications SET dispatch_claim_token = NULL, dispatch_lease_until = NULL, updated_at = clock_timestamp()
      WHERE id = ${id}::uuid AND status = 'queued' AND dispatch_claim_token = ${claimToken}::uuid
    `);
  }

  async claimForSend(id: string, leaseMs: number) {
    if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) throw new Error('Invalid notification send lease');
    const token = uuidv7();
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE notifications SET status = 'sending', dispatch_claim_token = ${token}::uuid,
        dispatch_lease_until = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
        attempts = attempts + 1, updated_at = clock_timestamp()
      WHERE id = ${id}::uuid AND (status = 'queued' OR status = 'failed')
      RETURNING id
    `);
    return rows.length ? { claimToken: token } : null;
  }

  async markSentWithClaim(id: string, claimToken: string, providerMessageId: string) {
    return this.transitionWithAudit(id, claimToken, 'sent', undefined, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE notifications SET status = 'sent', provider_message_id = ${providerMessageId},
        last_error = NULL, last_error_code = NULL, failed_at = NULL, sent_at = clock_timestamp(),
        dispatch_claim_token = NULL, dispatch_lease_until = NULL, updated_at = clock_timestamp()
      WHERE id = ${id}::uuid AND status = 'sending' AND dispatch_claim_token = ${claimToken}::uuid
        AND dispatch_lease_until > clock_timestamp()
    `));
  }

  async markFailedWithClaim(id: string, claimToken: string, errorCode: string) {
    return this.transitionWithAudit(id, claimToken, 'failed', errorCode, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE notifications SET status = 'failed', last_error = ${errorCode}, last_error_code = ${errorCode},
        failed_at = clock_timestamp(), dispatch_claim_token = NULL, dispatch_lease_until = NULL, updated_at = clock_timestamp()
      WHERE id = ${id}::uuid AND status = 'sending' AND dispatch_claim_token = ${claimToken}::uuid
        AND dispatch_lease_until > clock_timestamp()
    `));
  }

  async markUncertainWithClaim(id: string, claimToken: string, errorCode: string) {
    return this.transitionWithAudit(id, claimToken, 'uncertain', errorCode, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE notifications SET status = 'uncertain', last_error = ${errorCode}, last_error_code = ${errorCode},
        dispatch_claim_token = NULL, dispatch_lease_until = NULL, updated_at = clock_timestamp()
      WHERE id = ${id}::uuid AND status = 'sending' AND dispatch_claim_token = ${claimToken}::uuid
    `));
  }

  private async transitionWithAudit(
    id: string, claimToken: string, status: string, code: string | undefined,
    transition: (tx: Prisma.TransactionClient) => Promise<number>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (await transition(tx) !== 1) return false;
      const notification = await tx.notification.findUniqueOrThrow({ where: { id } });
      await tx.notificationAuditIntent.create({ data: {
        id: uuidv7(), notificationId: id, transitionKey: claimToken,
        action: `notification.${status}`, eventId: notification.eventId,
        afterData: code ? { status, code } : { status },
      } });
      return true;
    });
  }

  async flushAuditIntents(limit: number, notificationId?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid notification audit batch');
    return this.prisma.$transaction(async (tx) => {
      const intents = await tx.$queryRaw<Array<{ id: string; notification_id: string; action: string; event_id: string; after_data: Prisma.InputJsonValue; created_at: Date }>>(Prisma.sql`
        SELECT id, notification_id, action, event_id, after_data, created_at FROM notification_audit_intents
        WHERE recorded_at IS NULL AND (${notificationId ?? null}::uuid IS NULL OR notification_id = ${notificationId ?? null}::uuid)
        ORDER BY created_at, id LIMIT ${limit} FOR UPDATE SKIP LOCKED
      `);
      for (const intent of intents) {
        // Intent UUID is the audit identity. Insert and consumption are one local DB transaction.
        await tx.auditLog.create({ data: {
          id: intent.id, action: intent.action, entityType: 'notification', entityId: intent.notification_id,
          correlationId: intent.event_id, afterData: intent.after_data,
          createdAt: intent.created_at,
        } });
        await tx.notificationAuditIntent.update({ where: { id: intent.id }, data: { recordedAt: new Date() } });
      }
      return intents.length;
    });
  }

  async recoverExpiredSends(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid notification recovery batch');
    return this.prisma.$transaction(async (tx) => {
      const stale = await tx.$queryRaw<Array<{ id: string; dispatch_claim_token: string }>>(Prisma.sql`
        SELECT id, dispatch_claim_token FROM notifications
        WHERE status = 'sending' AND dispatch_lease_until <= clock_timestamp()
        ORDER BY dispatch_lease_until LIMIT ${limit} FOR UPDATE SKIP LOCKED
      `);
      for (const row of stale) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE notifications SET status = 'uncertain', last_error = 'SEND_OUTCOME_UNCERTAIN',
            last_error_code = 'SEND_OUTCOME_UNCERTAIN', dispatch_claim_token = NULL, dispatch_lease_until = NULL,
            updated_at = clock_timestamp() WHERE id = ${row.id}::uuid
        `);
        const notification = await tx.notification.findUniqueOrThrow({ where: { id: row.id } });
        await tx.notificationAuditIntent.create({ data: {
          id: uuidv7(), notificationId: row.id, transitionKey: row.dispatch_claim_token,
          action: 'notification.uncertain', eventId: notification.eventId,
          afterData: { status: 'uncertain', code: 'SEND_OUTCOME_UNCERTAIN' },
        } });
      }
      return stale.length;
    });
  }
}
