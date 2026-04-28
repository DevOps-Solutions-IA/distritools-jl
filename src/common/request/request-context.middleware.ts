import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { runWithRequestContext } from 'src/common/request/request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestIdHeader = request.header('x-request-id');
    const correlationIdHeader = request.header('x-correlation-id');
    const requestId = requestIdHeader?.trim() || uuidv7();
    const correlationId = correlationIdHeader?.trim() || requestId;

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);

    runWithRequestContext(
      {
        requestId,
        correlationId,
        ipAddress: request.ip,
        userAgent: request.header('user-agent') || undefined,
        path: request.path,
        method: request.method,
      },
      () => next(),
    );
  }
}
