import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { AuditLogEntity } from 'src/modules/audit/domain/entities/audit-log.entity';

export interface GetAuditLogInput {
  actor: CurrentUser;
  auditLogId: string;
}

@Injectable()
export class GetAuditLogUseCase {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: GetAuditLogInput) {
    assertHasPermissions(input.actor.permissions, ['audit.read']);

    const record = await this.auditRepository.findById(input.auditLogId);

    if (!record) {
      throw new NotFoundException('Audit log not found');
    }

    return AuditLogEntity.fromRecord(record).toResponse();
  }
}
