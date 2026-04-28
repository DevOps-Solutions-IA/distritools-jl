import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GetOperationalMetricsUseCase } from 'src/modules/analytics/application/use-cases/get-operational-metrics.use-case';
import { GetSalesSummaryUseCase } from 'src/modules/analytics/application/use-cases/get-sales-summary.use-case';
import { GetTopProductsUseCase } from 'src/modules/analytics/application/use-cases/get-top-products.use-case';
import { RefreshAnalyticsSnapshotsUseCase } from 'src/modules/analytics/application/use-cases/refresh-analytics-snapshots.use-case';
import {
  ANALYTICS_REPOSITORY,
} from 'src/modules/analytics/domain/repositories/analytics.repository';
import { AnalyticsWindowService } from 'src/modules/analytics/domain/services/analytics-window.service';
import { AnalyticsController } from 'src/modules/analytics/infrastructure/http/controllers/analytics.controller';
import { PrismaAnalyticsRepository } from 'src/modules/analytics/infrastructure/repositories/prisma-analytics.repository';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsWindowService,
    GetSalesSummaryUseCase,
    GetTopProductsUseCase,
    GetOperationalMetricsUseCase,
    RefreshAnalyticsSnapshotsUseCase,
    PrismaAnalyticsRepository,
    {
      provide: ANALYTICS_REPOSITORY,
      useExisting: PrismaAnalyticsRepository,
    },
  ],
})
export class AnalyticsModule {}
