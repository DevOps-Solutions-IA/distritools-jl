import Link from 'next/link';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { adminFetch } from '@/lib/admin/server-data';

interface AdminDetailPageProps {
  title: string;
  backHref: string;
  backLabel: string;
  backendPath: string;
}

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
    return <span className="text-[var(--color-text-secondary)]">No disponible</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[var(--color-text-secondary)]">Sin registros</span>;
    }

    return (
      <div className="grid gap-3">
        {value.slice(0, 6).map((item, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <DetailValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !['id', 'variantId', 'warehouseId', 'orderId', 'paymentId'].includes(key))
    .slice(0, 16);

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, item]) => (
        <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
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

export async function AdminDetailPage({
  title,
  backHref,
  backLabel,
  backendPath,
}: AdminDetailPageProps) {
  const result = await adminFetch<Record<string, unknown>>(backendPath);

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#121212_0%,#0b0b0b_62%,rgba(245,183,0,0.09)_100%)] p-5 shadow-elevated sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                Detalle operativo
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
                {title}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Vista protegida por sesión admin. No se exponen secretos ni payloads sensibles.
              </p>
            </div>
            <Badge variant={result.ok ? 'success' : 'warning'}>
              {result.ok ? 'Disponible' : `Error ${result.status}`}
            </Badge>
          </div>
          <div className="mt-6">
            <Link href={backHref}>
              <Button variant="outline">{backLabel}</Button>
            </Link>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          {result.ok ? (
            <DetailValue value={sanitizeForDisplay(result.data)} />
          ) : (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-5 text-sm text-amber-100">
              {result.error ?? 'No se pudo cargar el detalle.'}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
