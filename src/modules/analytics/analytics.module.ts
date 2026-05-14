import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GetAdminDashboardUseCase } from 'src/modules/analytics/application/use-cases/get-admin-dashboard.use-case';
import { GetAdminReportsUseCase } from 'src/modules/analytics/application/use-cases/get-admin-reports.use-case';
import { GetOperationalMetricsUseCase } from 'src/modules/analytics/application/use-cases/get-operational-metrics.use-case';
import { GetSalesSummaryUseCase } from 'src/modules/analytics/application/use-cases/get-sales-summary.use-case';
import { GetTopProductsUseCase } from 'src/modules/analytics/application/use-cases/get-top-products.use-case';
import { RefreshAnalyticsSnapshotsUseCase } from 'src/modules/analytics/application/use-cases/refresh-analytics-snapshots.use-case';
import {
  ANALYTICS_REPOSITORY,
} from 'src/modules/analytics/domain/repositories/analytics.repository';
import { AnalyticsWindowService } from 'src/modules/analytics/domain/services/analytics-window.service';
import { AdminDashboardController } from 'src/modules/analytics/infrastructure/http/controllers/admin-dashboard.controller';
import { AdminReportsController } from 'src/modules/analytics/infrastructure/http/controllers/admin-reports.controller';
import { AnalyticsController } from 'src/modules/analytics/infrastructure/http/controllers/analytics.controller';
import { PrismaAnalyticsRepository } from 'src/modules/analytics/infrastructure/repositories/prisma-analytics.repository';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController, AdminDashboardController, AdminReportsController],
  providers: [
    AnalyticsWindowService,
    GetAdminDashboardUseCase,
    GetAdminReportsUseCase,
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
