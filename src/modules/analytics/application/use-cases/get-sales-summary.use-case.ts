import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepository,
} from 'src/modules/analytics/domain/repositories/analytics.repository';
import { AnalyticsWindowService } from 'src/modules/analytics/domain/services/analytics-window.service';

@Injectable()
export class GetSalesSummaryUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepository,
    @Inject(AnalyticsWindowService)
    private readonly analyticsWindowService: AnalyticsWindowService,
  ) {}

  async execute(actor: CurrentUser, windowFrom?: string, windowTo?: string) {
    assertHasPermissions(actor.permissions, ['analytics.read']);
    const window = this.analyticsWindowService.normalizeWindow(windowFrom, windowTo);
    return this.analyticsRepository.getSalesSummary(window.windowFrom, window.windowTo);
  }
}
