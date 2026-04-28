import { Global, Module } from '@nestjs/common';
import { MonitoringController } from 'src/infra/monitoring/monitoring.controller';
import { MetricsInterceptor } from 'src/infra/telemetry/metrics/metrics.interceptor';
import { MetricsService } from 'src/infra/telemetry/metrics/metrics.service';

@Global()
@Module({
  controllers: [MonitoringController],
  providers: [MetricsService, MetricsInterceptor],
  exports: [MetricsService, MetricsInterceptor],
})
export class MonitoringModule {}
