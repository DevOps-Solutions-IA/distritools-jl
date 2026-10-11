import type { Metadata } from 'next';
import { AdminProductCompleteForm } from '@/components/admin/forms/AdminProductCompleteForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { catalogOptions } from '@/features/admin/catalog/server';


export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nuevo producto admin | DistriTools JL',
  robots: { index: false, follow: false },
};

export default async function AdminNewProductPage() {
  const options = await catalogOptions();

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            products.write
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            Nuevo producto completo
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Crea producto, variante inicial, SKU, precio, costo, stock, imagen, dimensiones y validación de vendibilidad desde un solo flujo operativo.
          </p>
        </section>
        <AdminProductCompleteForm
          mode="create"
          brands={options.brands}
          categories={options.categories}
          warehouses={options.warehouses}
        />
      </div>
    </AdminShell>
  );
}
