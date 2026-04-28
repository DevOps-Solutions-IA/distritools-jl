import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepository,
} from 'src/modules/analytics/domain/repositories/analytics.repository';
import { AnalyticsWindowService } from 'src/modules/analytics/domain/services/analytics-window.service';

@Injectable()
export class RefreshAnalyticsSnapshotsUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepository,
    @Inject(AnalyticsWindowService)
    private readonly analyticsWindowService: AnalyticsWindowService,
  ) {}

  async execute(actor: CurrentUser, windowFrom?: string, windowTo?: string) {
    assertHasPermissions(actor.permissions, ['analytics.read']);
    const window = this.analyticsWindowService.normalizeWindow(windowFrom, windowTo);

    const [salesSummary, topProducts, orderStatusCounts, paymentStatusCounts, inventoryStatus] =
      await Promise.all([
        this.analyticsRepository.getSalesSummary(window.windowFrom, window.windowTo),
        this.analyticsRepository.getTopProducts(5, window.windowFrom, window.windowTo),
        this.analyticsRepository.getOrderStatusCounts(),
        this.analyticsRepository.getPaymentStatusCounts(),
        this.analyticsRepository.getInventoryStatus(),
      ]);

    await Promise.all([
      this.analyticsRepository.refreshSnapshot(
        'sales_summary',
        salesSummary,
        window.windowFrom,
        window.windowTo,
      ),
      this.analyticsRepository.refreshSnapshot(
        'top_products',
        topProducts,
        window.windowFrom,
        window.windowTo,
      ),
      this.analyticsRepository.refreshSnapshot(
        'operational_metrics',
        { orderStatusCounts, paymentStatusCounts, inventoryStatus },
        window.windowFrom,
        window.windowTo,
      ),
    ]);

    return {
      refreshed: true,
    };
  }
}
