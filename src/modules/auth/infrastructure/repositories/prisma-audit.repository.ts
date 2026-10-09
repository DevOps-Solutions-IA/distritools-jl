import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { RequestContextService } from 'src/common/request/request-context.service';
import { parsePageSize } from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AuditLogQuery,
  AuditLogRecord,
  AuditLogInput,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
  ) {}

  private sanitizePayload(payload: unknown): unknown {
    if (typeof payload === 'bigint') {
      return payload.toString();
    }

    if (payload instanceof Date) {
      return payload.toISOString();
    }

    if (payload instanceof Prisma.Decimal) {
      return payload.toString();
    }

    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizePayload(item));
    }

    const redacted = { ...(payload as Record<string, unknown>) };

    for (const key of Object.keys(redacted)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        this.isSensitiveField(normalizedKey) ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('password') ||
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('cookie') ||
        normalizedKey.includes('otp') ||
        normalizedKey.includes('totp') ||
        normalizedKey.includes('recovery') ||
        normalizedKey.includes('challenge') ||
        normalizedKey.includes('credential') ||
        normalizedKey.includes('apikey') ||
        normalizedKey.includes('accesskey') ||
        normalizedKey.includes('privatekey') ||
        normalizedKey === 'signature' ||
        normalizedKey.includes('payload') ||
        normalizedKey === 'rawbody'
      ) {
        redacted[key] = '[REDACTED]';
        continue;
      }

      redacted[key] = this.sanitizePayload(redacted[key]);
    }

    return redacted;
  }

  private isSensitiveField(normalizedKey: string): boolean {
    return [
      'email', 'phone', 'mobile', 'address', 'document', 'customername', 'fullname',
      'firstname', 'lastname', 'recipient',
    ].some((field) => normalizedKey.includes(field));
  }

  private mapRecord(record: {
    id: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    requestId: string | null;
    correlationId: string | null;
    beforeData: unknown;
    afterData: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }): AuditLogRecord {
    return {
      id: record.id,
      actorUserId: record.actorUserId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      requestId: record.requestId,
      correlationId: record.correlationId,
      beforeData: this.sanitizePayload(record.beforeData),
      afterData: this.sanitizePayload(record.afterData),
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      createdAt: record.createdAt,
    };
  }

  async write(
    entry: AuditLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const requestContext = this.requestContextService.get();

    await (tx ?? this.prisma).auditLog.create({
      data: {
        id: uuidv7(),
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        requestId: entry.requestId ?? requestContext?.requestId,
        correlationId: entry.correlationId ?? requestContext?.correlationId,
        beforeData: this.sanitizePayload(entry.beforeData) as unknown as Prisma.InputJsonValue,
        afterData: this.sanitizePayload(entry.afterData) as unknown as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? requestContext?.ipAddress,
        userAgent: entry.userAgent ?? requestContext?.userAgent,
      },
    });
  }

  async list(query: AuditLogQuery = {}): Promise<AuditLogRecord[]> {
    const limit = parsePageSize(query.limit, 50);
    const records = await this.prisma.auditLog.findMany({
      where: {
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return records.map((record) => this.mapRecord(record));
  }

  async findById(id: string): Promise<AuditLogRecord | null> {
    const record = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    return record ? this.mapRecord(record) : null;
  }
}
