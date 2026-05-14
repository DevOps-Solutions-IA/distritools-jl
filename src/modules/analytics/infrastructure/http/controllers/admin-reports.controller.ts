import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { GetAdminReportsUseCase } from 'src/modules/analytics/application/use-cases/get-admin-reports.use-case';

interface ReportQuery {
  range?: string;
  status?: string;
  module?: string;
  paymentStatus?: string;
  shippingStatus?: string;
}

interface ExportBody extends ReportQuery {
  type?: string;
  format?: string;
  includePii?: boolean;
}

const DEV_ADMIN_BYPASS_USER_ID = '00000000-0000-7000-8000-000000000099';

function safeAuditActorId(actor: CurrentUser): string | undefined {
  return actor.sub === DEV_ADMIN_BYPASS_USER_ID ? undefined : actor.sub;
}

@ApiTags('admin-reports')
@ApiBearerAuth()
@Controller('admin/reports')
export class AdminReportsController {
  constructor(
    @Inject(GetAdminReportsUseCase)
    private readonly getAdminReportsUseCase: GetAdminReportsUseCase,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  @Permissions('reports.read')
  @Get('summary')
  summary(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    return this.getAdminReportsUseCase.execute(actor, query);
  }

  @Permissions('reports.financial.read')
  @Get('sales')
  async sales(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { sales: unknown } }).reports.sales;
  }

  @Permissions('reports.read')
  @Get('orders')
  async orders(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { orders: unknown } }).reports.orders;
  }

  @Permissions('reports.read')
  @Get('payments')
  async payments(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { payments: unknown } }).reports.payments;
  }

  @Permissions('reports.read')
  @Get('inventory')
  async inventory(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { inventory: unknown } }).reports.inventory;
  }

  @Permissions('reports.read')
  @Get('shipping')
  async shipping(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { shipping: unknown } }).reports.shipping;
  }

  @Permissions('reports.read')
  @Get('notifications')
  async notifications(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { notifications: unknown } }).reports.notifications;
  }

  @Permissions('reports.read')
  @Get('readiness')
  async readiness(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { readiness: unknown; blockers: unknown } }).reports.readiness;
  }

  @Permissions('audit.read')
  @Get('audit')
  async audit(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query() query: ReportQuery,
  ): Promise<unknown> {
    const report = await this.getAdminReportsUseCase.execute(actor, query);
    return (report as { reports: { audit: unknown } }).reports.audit;
  }

  @Permissions('reports.export')
  @Post('export')
  @HttpCode(200)
  async export(
    @CurrentUserDecorator() actor: CurrentUser,
    @Body() body: ExportBody,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.getAdminReportsUseCase.buildExport(actor, body);
    await this.auditRepository.write({
      actorUserId: safeAuditActorId(actor),
      action: body.includePii ? 'reports.exported_with_pii' : 'reports.exported',
      entityType: 'reports_export',
      entityId: uuidv7(),
      afterData: {
        type: result.type,
        format: body.format ?? 'csv',
        filters: result.filters,
        range: result.range,
        rows: result.rows.length,
        containsPii: Boolean(body.includePii),
      },
      ipAddress,
      userAgent,
    });

    if (result.format === 'pdf' && result.pdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="distritools-report-${result.type}.pdf"`);
      return res.send(result.pdf);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="distritools-report-${result.type}.csv"`);
    return res.send(result.csv);
  }
}
