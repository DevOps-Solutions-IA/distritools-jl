import { Injectable } from '@nestjs/common';

interface RouteMetric {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly routeMetrics = new Map<string, RouteMetric>();

  recordRequest(routeKey: string, durationMs: number, statusCode: number): void {
    const current = this.routeMetrics.get(routeKey) ?? {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    };

    current.count += 1;
    current.totalDurationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);

    if (statusCode >= 400) {
      current.errorCount += 1;
    }

    this.routeMetrics.set(routeKey, current);
  }

  snapshot() {
    return {
      uptimeMs: Date.now() - this.startedAt,
      routes: [...this.routeMetrics.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([route, metric]) => ({
          route,
          count: metric.count,
          errorCount: metric.errorCount,
          averageDurationMs:
            metric.count === 0 ? 0 : Number((metric.totalDurationMs / metric.count).toFixed(2)),
          maxDurationMs: Number(metric.maxDurationMs.toFixed(2)),
        })),
    };
  }
}
