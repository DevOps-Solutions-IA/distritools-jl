import { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface CreateNotificationRecord {
  id: string;
  eventId: string;
  eventName: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  content: string;
  provider: string;
  payload?: unknown;
}

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
  createIfAbsent(
    data: CreateNotificationRecord,
  ): Promise<{ notification: NotificationRecord; inserted: boolean }>;
  findById(id: string): Promise<NotificationRecord | null>;
  list(limit?: number): Promise<NotificationRecord[]>;
  markSent(id: string, providerMessageId: string): Promise<NotificationRecord>;
  markFailed(id: string, errorMessage: string): Promise<NotificationRecord>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
