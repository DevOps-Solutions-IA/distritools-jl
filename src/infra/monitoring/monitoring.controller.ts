import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { REDIS } from 'src/infra/cache/redis.module';
import Redis from 'ioredis';
import { MetricsService } from 'src/infra/telemetry/metrics/metrics.service';

@ApiExcludeController()
@Controller()
export class MonitoringController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(REDIS)
    private readonly redis: Redis,
    @Inject(MetricsService)
    private readonly metricsService: MetricsService,
  ) {}

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    const redisPing = await this.redis.ping();

    return {
      status: redisPing === 'PONG' ? 'ready' : 'degraded',
      checks: {
        database: 'ok',
        redis: redisPing,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('metrics')
  getMetrics() {
    return this.metricsService.snapshot();
  }
}
