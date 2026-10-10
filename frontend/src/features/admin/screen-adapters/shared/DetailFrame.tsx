import Link from 'next/link';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type {
  DetailPageProps,
  DetailResult,
  DetailScreenAdapter,
} from './types';

export function DetailFrame({
  title,
  backHref,
  backLabel,
  result,
  Screen,
}: Omit<DetailPageProps, 'backendPath'> & {
  result: DetailResult;
  Screen: DetailScreenAdapter;
}) {
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
                Vista protegida por sesión admin. No se exponen secretos ni
                payloads sensibles.
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
            <Screen value={result.data} />
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
