export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function textValue(value: unknown, fallback = 'Pendiente') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function statusVariant(
  status: unknown,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (
    status === 'production_ready' ||
    status === 'READY_FOR_PRODUCTION' ||
    status === 'READY' ||
    status === 'pass'
  )
    return 'success';
  if (
    status === 'production_blocked' ||
    status === 'BLOCKED_FOR_PRODUCTION' ||
    status === 'NO_GO' ||
    status === 'BLOCKED_CONFIGURATION' ||
    status === 'fail' ||
    status === 'unsafe_configuration'
  )
    return 'danger';
  if (status === 'pending_documentation' || status === 'PENDING_DOCUMENTATION')
    return 'neutral';
  if (
    status === 'mock_local' ||
    status === 'MOCK_ONLY' ||
    status === 'pending_credentials' ||
    status === 'BLOCKED_PROVIDER' ||
    status === 'sandbox_ready'
  )
    return 'warning';
  return 'info';
}

export function moneyValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return `$ ${numeric.toLocaleString('es-CO')}`;
}
