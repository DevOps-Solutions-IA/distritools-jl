import { env } from '@/config/env';
import { ApiError } from '@/lib/api/errors';
import type { ApiRequestOptions, ApiSuccess } from '@/lib/api/types';

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204 || !contentType) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiSuccess<T>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const maxRetries = 3;
  const retryDelay = 2000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${env.apiBaseUrl}${path}`, {
        ...options,
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const parsed = await parseResponse(response);

      if (!response.ok) {
        throw new ApiError({
          message:
            typeof parsed === 'object' &&
            parsed !== null &&
            'message' in parsed &&
            typeof parsed.message === 'string'
              ? parsed.message
              : `Request failed with status ${response.status}`,
          status: response.status,
          payload: parsed,
        });
      }

      clearTimeout(timeout);
      return {
        data: parsed as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error; // Don't retry on API errors (like 4xx or 5xx)
      }

      if (i === maxRetries - 1) {
        // Last retry failed, throw the error
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiError({
            message: `Request timed out after ${timeoutMs}ms`,
            status: 408,
          });
        }
        throw new ApiError({
          message: error instanceof Error ? error.message : 'Unknown network error',
          status: 500,
        });
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // This part should be unreachable, but typescript needs a return path.
  throw new ApiError({
    message: 'Request failed after multiple retries',
    status: 500,
  });
}

export function createApiClient(basePath = '') {
  return {
    get: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      apiRequest<T>(`${basePath}${path}`, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      apiRequest<T>(`${basePath}${path}`, { ...options, method: 'POST', body }),
    patch: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      apiRequest<T>(`${basePath}${path}`, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      apiRequest<T>(`${basePath}${path}`, { ...options, method: 'DELETE' }),
  };
}
