import { Controller, Get, Inject, Optional, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from 'src/common/decorators/public.decorator';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MetricsService } from 'src/infra/telemetry/metrics/metrics.service';
import { DOMAIN_EVENTS_QUEUE } from 'src/infra/queue/bullmq.module';
import { DomainEventsWorker } from 'src/infra/events/domain-events.worker';

@ApiExcludeController()
@Controller()
export class MonitoringController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @InjectQueue(DOMAIN_EVENTS_QUEUE)
    private readonly producerQueue: Queue,
    @Inject(DomainEventsWorker)
    private readonly domainWorker: DomainEventsWorker | null,
    @Inject(MetricsService)
    private readonly metricsService: MetricsService,
    @Optional() @Inject('READINESS_DEADLINE_MS') private readonly readinessDeadlineMs = 750,
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
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const domainWorker = this.domainWorker;
    const [database, producer, worker] = await Promise.all([
      this.withDeadline(() => this.prisma.$queryRaw`SELECT 1`),
      this.withDeadline(async () => {
        await this.producerQueue.waitUntilReady();
        const client = await this.producerQueue.client as unknown as { ping(): Promise<string> };
        return client.ping();
      }),
      domainWorker ? this.withDeadline(async () => {
        const client = await domainWorker.worker.client as unknown as { status: string; ping(): Promise<string> };
        return client.status === 'ready' ? client.ping() : 'NOT_READY';
      }) : Promise.resolve({ ok: false as const }),
    ]);
    const databaseReady = database.ok;
    const producerReady = producer.ok && producer.value === 'PONG';
    const workerReady = domainWorker ? worker.ok && worker.value === 'PONG' : undefined;
    const ready = databaseReady && producerReady && (workerReady ?? true);
    response.status(ready ? 200 : 503);

    return {
      status: ready ? 'ready' : 'degraded',
      ready,
      checks: {
        database: databaseReady ? 'ok' : 'unavailable',
        queueProducer: producerReady ? 'ready' : 'unavailable',
        queueWorker: workerReady === undefined ? 'not_required_for_api_role' : workerReady ? 'ready' : 'unavailable',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async withDeadline<T>(operation: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race([
        operation().then((value) => ({ ok: true as const, value })),
        new Promise<{ ok: false }>((resolve) => {
          timer = setTimeout(() => resolve({ ok: false }), this.readinessDeadlineMs);
        }),
      ]);
      return result;
    } catch {
      return { ok: false };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  @Public()
  @Get('metrics')
  getMetrics() {
    return this.metricsService.snapshot();
  }
}
