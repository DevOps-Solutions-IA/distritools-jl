import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepository,
} from 'src/modules/analytics/domain/repositories/analytics.repository';

@Injectable()
export class GetOperationalMetricsUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepository,
  ) {}

  async execute(actor: CurrentUser) {
    assertHasPermissions(actor.permissions, ['analytics.read']);

    const [orderStatusCounts, paymentStatusCounts, inventoryStatus] = await Promise.all([
      this.analyticsRepository.getOrderStatusCounts(),
      this.analyticsRepository.getPaymentStatusCounts(),
      this.analyticsRepository.getInventoryStatus(),
    ]);

    return {
      orderStatusCounts,
      paymentStatusCounts,
      inventoryStatus,
    };
  }
}
