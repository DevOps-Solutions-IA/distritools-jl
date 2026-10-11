export type AdminFailureKind =
  | 'auth_required'
  | 'forbidden'
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'provider_blocked'
  | 'server_error'
  | 'network_error'
  | 'contract_error';

export type AdminApiResult<T> =
  | { ok: true; kind: 'success'; status: number; data: T; error: null }
  | {
      ok: false;
      kind: AdminFailureKind;
      status: number;
      data: null;
      error: string;
    };

export function adminFailure(
  status: number,
  payload?: unknown,
): Extract<AdminApiResult<never>, { ok: false }> {
  const body =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};
  const detail = body.message ?? body.error;
  // Exact public message from AdminOperationsController.sendQuote; do not guess from status503 alone.
  const quoteProviderBlocked =
    status === 503 &&
    detail ===
      'El envío de cotizaciones no está disponible para el proveedor configurado.';
  const kind: AdminFailureKind = quoteProviderBlocked
    ? 'provider_blocked'
    : status === 0
      ? 'network_error'
      : status === 401
        ? 'auth_required'
        : status === 403
          ? 'forbidden'
          : status === 400 || status === 422
            ? 'validation_error'
            : status === 404
              ? 'not_found'
              : status === 409
                ? 'conflict'
                : status === 429
                  ? 'rate_limited'
                  : 'server_error';
  const messages: Record<AdminFailureKind, string> = {
    auth_required: 'Sesión administrativa requerida.',
    forbidden: 'No tiene permiso para leer este módulo.',
    validation_error: 'Revise los parámetros de la solicitud.',
    not_found: 'El recurso no está disponible.',
    conflict: 'La operación entra en conflicto con el estado actual.',
    rate_limited: 'Demasiadas solicitudes. Intente de nuevo más tarde.',
    provider_blocked:
      'El proveedor configurado no permite esta operación administrativa.',
    server_error: 'No se pudo leer el módulo admin.',
    network_error: 'No se pudo conectar con el servicio administrativo.',
    contract_error: 'El servicio devolvió una respuesta inválida.',
  };
  const error =
    kind === 'validation_error' &&
    (typeof detail === 'string' || Array.isArray(detail))
      ? Array.isArray(detail)
        ? detail
            .filter((item): item is string => typeof item === 'string')
            .join(' ')
        : detail
      : messages[kind];
  return {
    ok: false,
    kind,
    status,
    data: null,
    error: error || messages[kind],
  };
}

export function adminContractFailure(
  status: number,
): Extract<AdminApiResult<never>, { ok: false }> {
  return {
    ok: false,
    kind: 'contract_error',
    status,
    data: null,
    error: 'El servicio devolvió una respuesta inválida.',
  };
}

export class AdminReadError extends Error {
  constructor(
    public readonly result: Extract<AdminApiResult<never>, { ok: false }>,
  ) {
    super(result.error);
    this.name = 'AdminReadError';
  }
}
