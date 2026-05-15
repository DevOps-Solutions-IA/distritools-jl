import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateNotificationRecord,
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
      ...record,
    };
  }

  async createIfAbsent(data: CreateNotificationRecord) {
    const result = await this.prisma.notification.createMany({
      data: [
        {
          id: data.id,
          eventId: data.eventId,
          eventName: data.eventName,
          channel: data.channel,
          recipient: data.recipient,
          subject: data.subject,
          content: data.content,
          provider: data.provider,
          payload: data.payload as unknown as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });

    const notification = await this.prisma.notification.findFirstOrThrow({
      where: {
        eventId: data.eventId,
        channel: data.channel,
        recipient: data.recipient,
      },
    });

    return {
      notification: this.map(notification),
      inserted: result.count > 0,
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

  async markSent(id: string, providerMessageId: string) {
    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        status: 'sent',
        providerMessageId,
        attempts: {
          increment: 1,
        },
        lastError: null,
        failedAt: null,
        sentAt: new Date(),
      },
    });

    return this.map(updated);
  }

  async markFailed(id: string, errorMessage: string) {
    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        status: 'failed',
        attempts: {
          increment: 1,
        },
        lastError: errorMessage,
        failedAt: new Date(),
      },
    });

    return this.map(updated);
  }
}
