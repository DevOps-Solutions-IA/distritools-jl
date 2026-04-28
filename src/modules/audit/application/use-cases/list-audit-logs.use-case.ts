import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { AuditLogEntity } from 'src/modules/audit/domain/entities/audit-log.entity';

export interface ListAuditLogsInput {
  actor: CurrentUser;
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

@Injectable()
export class ListAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: ListAuditLogsInput) {
    assertHasPermissions(input.actor.permissions, ['audit.read']);

    const records = await this.auditRepository.list({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      limit: input.limit,
    });

    return {
      data: records.map((record) => AuditLogEntity.fromRecord(record).toResponse()),
    };
  }
}
