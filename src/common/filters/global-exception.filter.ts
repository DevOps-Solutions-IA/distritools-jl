import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { isProductionOrStaging } from 'src/common/security/env-check';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { context?: { requestId: string; correlationId: string } }>();

    const correlationId = request.context?.correlationId ??
      response.getHeader('x-correlation-id')?.toString() ??
      'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      response.status(status).json({
        statusCode: status,
        error: typeof body === 'string' ? body : (body as Record<string, unknown>).message ?? 'Error',
        correlationId,
      });

      return;
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.path}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const safe = isProductionOrStaging();

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: safe ? 'Internal server error' : (exception as Error)?.message ?? 'Internal server error',
      correlationId,
    });
  }
}
