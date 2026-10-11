export class CatalogRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean, readonly status = 0) { super(message); }
}
/** Never retries a write. A lost/malformed/5xx acknowledgement may follow persistence. */
export async function catalogRequest(path: string, method: 'PATCH' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
  let response: Response;
  let payload: unknown;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { response = await fetch(path, { method, signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' }); payload = await response.json().catch(() => null); }
  catch { throw new CatalogRequestError('Conexión interrumpida: no se pudo confirmar el resultado. Revisa el estado persistido antes de repetir.', true); }
  finally { clearTimeout(timeout); }
  if (!response.ok) {
    const labels: Record<number, string> = { 401: 'Sesión vencida. Inicia sesión antes de continuar.', 403: 'No tienes permiso para esta operación.', 404: 'El registro ya no existe.', 409: 'Conflicto: el slug o SKU ya existe. Revisa el registro.', 422: 'La relación comercial no está autorizada.' };
    let message = labels[response.status] ?? `No se completó la operación (HTTP ${response.status}).`;
    if (response.status === 400 && payload && typeof payload === 'object' && 'message' in payload) {
      const value = payload.message;
      message = Array.isArray(value) && value.every((item) => typeof item === 'string') ? value.join('; ') : typeof value === 'string' ? value : 'Datos inválidos. Revisa los campos.';
    }
    if (response.status >= 500) message += ' No se pudo confirmar el estado guardado. Revisa antes de repetir.';
    throw new CatalogRequestError(message, response.status >= 500, response.status);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new CatalogRequestError('Respuesta inválida: no se pudo confirmar el resultado guardado. Revisa antes de repetir.', true);
  return payload as Record<string, unknown>;
}
