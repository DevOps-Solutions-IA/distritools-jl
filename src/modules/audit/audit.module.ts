import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GetAuditLogUseCase } from 'src/modules/audit/application/use-cases/get-audit-log.use-case';
import { ListAuditLogsUseCase } from 'src/modules/audit/application/use-cases/list-audit-logs.use-case';
import { AuditController } from 'src/modules/audit/infrastructure/http/controllers/audit.controller';

@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [ListAuditLogsUseCase, GetAuditLogUseCase],
})
export class AuditModule {}
