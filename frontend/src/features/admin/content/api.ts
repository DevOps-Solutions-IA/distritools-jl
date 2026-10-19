import { z } from 'zod';
import { adminFailure } from '@/lib/admin/transport/result';

export class ContentRequestError extends Error {
  constructor(
    public readonly kind: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function contentRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/content/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      cache: 'no-store',
    });
  } catch {
    throw new ContentRequestError(
      'network_error',
      0,
      'No se pudo conectar con el servicio de contenido.',
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 502 &&
      payload &&
      typeof payload === 'object' &&
      'kind' in payload &&
      payload.kind === 'network_error'
    ) {
      throw new ContentRequestError(
        'network_error',
        502,
        'No se pudo conectar con el servicio de contenido.',
      );
    }
    const failure = adminFailure(response.status, payload);
    throw new ContentRequestError(failure.kind, response.status, failure.error);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    throw new ContentRequestError(
      'contract_error',
      response.status,
      'El servicio devolvió una respuesta de contenido inválida. Recargue antes de continuar.',
    );
  return parsed.data;
}
