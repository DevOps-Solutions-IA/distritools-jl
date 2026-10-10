import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { CatalogSnapshot } from '../shared/types';

export function CatalogSnapshotSummary({
  snapshot,
}: {
  snapshot: CatalogSnapshot;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
            Snapshot real
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Datos leídos del catálogo. Operación sin provider/listado se muestra
            como riesgo, no como dato simulado.
          </p>
        </div>
        <Link href="/admin/dashboard">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Productos', snapshot.products],
          ['Marcas', snapshot.brands],
          ['Categorías', snapshot.categories],
          ['Variantes', snapshot.variants],
          ['Sin precio', snapshot.productsWithoutPrice],
          ['Sin SKU', snapshot.productsWithoutSku],
          ['Sin imagen', snapshot.productsWithoutImage],
          ['Cotización', snapshot.quoteOnlyProducts],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-off-white)]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
