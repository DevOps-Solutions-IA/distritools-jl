import type { DetailScreenProps } from './types';

function sanitizeForDisplay(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDisplay(item));
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => {
      const normalized = key.toLowerCase();
      if (
        normalized.includes('secret') ||
        normalized.includes('token') ||
        normalized.includes('rawpayload') ||
        normalized === 'signature'
      ) {
        return [key, '[REDACTED]'];
      }

      return [key, sanitizeForDisplay(item)];
    }),
  );
}

function formatLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function DetailValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return (
      <span className="text-[var(--color-text-secondary)]">No disponible</span>
    );
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span className="text-[var(--color-text-secondary)]">
          Sin registros
        </span>
      );
    }

    return (
      <div className="grid gap-3">
        {value.slice(0, 6).map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <DetailValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(
      ([key]) =>
        !['id', 'variantId', 'warehouseId', 'orderId', 'paymentId'].includes(
          key,
        ),
    )
    .slice(0, 16);

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, item]) => (
        <div
          key={key}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
        >
          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
            {formatLabel(key)}
          </dt>
          <dd className="mt-2 text-sm text-[var(--color-off-white)]">
            <DetailValue value={item} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Compatibility renderer: preserve recursive redaction, key order and 6/16 limits.
export function LegacyDetailBody({ value }: DetailScreenProps) {
  return <DetailValue value={sanitizeForDisplay(value)} />;
}
