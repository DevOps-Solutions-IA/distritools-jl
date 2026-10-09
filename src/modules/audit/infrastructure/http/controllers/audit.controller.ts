import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { parsePageSize } from 'src/common/utils/pagination.util';
import { GetAuditLogUseCase } from 'src/modules/audit/application/use-cases/get-audit-log.use-case';
import { ListAuditLogsUseCase } from 'src/modules/audit/application/use-cases/list-audit-logs.use-case';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('admin/audit')
export class AuditController {
  constructor(
    @Inject(ListAuditLogsUseCase)
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    @Inject(GetAuditLogUseCase)
    private readonly getAuditLogUseCase: GetAuditLogUseCase,
  ) {}

  @Permissions('audit.read')
  @Get()
  list(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listAuditLogsUseCase.execute({
      actor,
      action,
      entityType,
      entityId,
      limit: parsePageSize(limit, 50),
    });
  }

  @Permissions('audit.read')
  @Get(':auditLogId')
  getById(
    @Param('auditLogId') auditLogId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.getAuditLogUseCase.execute({
      actor,
      auditLogId,
    });
  }
}
