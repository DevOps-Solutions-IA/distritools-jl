import { Prisma } from '@prisma/client';

export interface AuditLogInput {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  correlationId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogRecord {
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
}

export interface AuditLogQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export interface AuditRepository {
  write(entry: AuditLogInput, tx?: Prisma.TransactionClient): Promise<void>;
  list(query?: AuditLogQuery): Promise<AuditLogRecord[]>;
  findById(id: string): Promise<AuditLogRecord | null>;
}

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');
