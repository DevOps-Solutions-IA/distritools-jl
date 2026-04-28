import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextState {
  requestId: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  method?: string;
}

@Injectable()
export class RequestContextService {
  run<T>(state: RequestContextState, callback: () => T): T {
    return requestContextStorage.run(state, callback);
  }

  get(): RequestContextState | undefined {
    return requestContextStorage.getStore();
  }
}

const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export function runWithRequestContext<T>(
  state: RequestContextState,
  callback: () => T,
): T {
  return requestContextStorage.run(state, callback);
}

export function getRequestContext(): RequestContextState | undefined {
  return requestContextStorage.getStore();
}
