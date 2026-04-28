export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: HttpMethod;
  body?: unknown;
  timeoutMs?: number;
}

export interface ApiSuccess<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiErrorPayload {
  message: string;
  status: number;
  payload?: unknown;
}
