import type { ApiErrorPayload } from '@/lib/api/types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload?: unknown;

  constructor({ message, status, payload }: ApiErrorPayload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}
