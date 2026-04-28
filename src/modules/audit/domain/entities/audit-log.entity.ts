import { AuditLogRecord } from 'src/modules/auth/domain/repositories/audit.repository';

export class AuditLogEntity {
  constructor(private readonly state: AuditLogRecord) {}

  static fromRecord(record: AuditLogRecord): AuditLogEntity {
    return new AuditLogEntity(record);
  }

  toResponse() {
    return {
      id: this.state.id,
      actorUserId: this.state.actorUserId,
      action: this.state.action,
      entityType: this.state.entityType,
      entityId: this.state.entityId,
      requestId: this.state.requestId,
      correlationId: this.state.correlationId,
      beforeData: this.state.beforeData,
      afterData: this.state.afterData,
      ipAddress: this.state.ipAddress,
      userAgent: this.state.userAgent,
      createdAt: this.state.createdAt,
    };
  }
}
