import { Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetOperationalMetricsUseCase } from 'src/modules/analytics/application/use-cases/get-operational-metrics.use-case';
import { GetSalesSummaryUseCase } from 'src/modules/analytics/application/use-cases/get-sales-summary.use-case';
import { GetTopProductsUseCase } from 'src/modules/analytics/application/use-cases/get-top-products.use-case';
import { RefreshAnalyticsSnapshotsUseCase } from 'src/modules/analytics/application/use-cases/refresh-analytics-snapshots.use-case';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(
    @Inject(GetSalesSummaryUseCase)
    private readonly getSalesSummaryUseCase: GetSalesSummaryUseCase,
    @Inject(GetTopProductsUseCase)
    private readonly getTopProductsUseCase: GetTopProductsUseCase,
    @Inject(GetOperationalMetricsUseCase)
    private readonly getOperationalMetricsUseCase: GetOperationalMetricsUseCase,
    @Inject(RefreshAnalyticsSnapshotsUseCase)
    private readonly refreshAnalyticsSnapshotsUseCase: RefreshAnalyticsSnapshotsUseCase,
  ) {}

  @Permissions('analytics.read')
  @Get('sales-summary')
  salesSummary(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('windowFrom') windowFrom?: string,
    @Query('windowTo') windowTo?: string,
  ) {
    return this.getSalesSummaryUseCase.execute(actor, windowFrom, windowTo);
  }

  @Permissions('analytics.read')
  @Get('top-products')
  topProducts(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('limit') limit?: string,
    @Query('windowFrom') windowFrom?: string,
    @Query('windowTo') windowTo?: string,
  ) {
    return this.getTopProductsUseCase.execute(
      actor,
      limit ? Number(limit) : 5,
      windowFrom,
      windowTo,
    );
  }

  @Permissions('analytics.read')
  @Get('operational-metrics')
  operationalMetrics(@CurrentUserDecorator() actor: CurrentUser) {
    return this.getOperationalMetricsUseCase.execute(actor);
  }

  @Permissions('analytics.read')
  @Post('refresh')
  refresh(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('windowFrom') windowFrom?: string,
    @Query('windowTo') windowTo?: string,
  ) {
    return this.refreshAnalyticsSnapshotsUseCase.execute(actor, windowFrom, windowTo);
  }
}
