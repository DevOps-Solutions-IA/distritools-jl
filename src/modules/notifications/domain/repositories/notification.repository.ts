import { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface NotificationRecord {
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
}

export interface NotificationRepository {
  findById(id: string): Promise<NotificationRecord | null>;
  list(limit?: number): Promise<NotificationRecord[]>;
  claimDispatchBatch(limit: number, leaseMs: number, eventId?: string): Promise<Array<{ id: string; claimToken: string }>>;
  releaseDispatchClaim(id: string, claimToken: string): Promise<void>;
  claimForSend(id: string, leaseMs: number): Promise<{ claimToken: string } | null>;
  markSentWithClaim(id: string, claimToken: string, providerMessageId: string): Promise<boolean>;
  markFailedWithClaim(id: string, claimToken: string, errorCode: string): Promise<boolean>;
  markUncertainWithClaim(id: string, claimToken: string, errorCode: string): Promise<boolean>;
  recoverExpiredSends(limit: number): Promise<number>;
  flushAuditIntents(limit: number, notificationId?: string): Promise<number>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
