import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from 'src/infra/telemetry/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      route?: { path?: string };
      path?: string;
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const route = request.route?.path ?? request.path ?? 'unknown';
    const routeKey = `${request.method} ${route}`;
    const startedAt = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.metricsService.recordRequest(
            routeKey,
            performance.now() - startedAt,
            response.statusCode,
          );
        },
        error: () => {
          this.metricsService.recordRequest(
            routeKey,
            performance.now() - startedAt,
            response.statusCode || 500,
          );
        },
      }),
    );
  }
}
