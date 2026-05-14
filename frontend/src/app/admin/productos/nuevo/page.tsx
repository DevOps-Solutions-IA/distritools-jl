import type { Metadata } from 'next';
import { AdminProductForm } from '@/components/admin/forms/AdminProductForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { getAdminCatalogSnapshot } from '@/lib/admin/operations';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nuevo producto admin | DistriTools JL',
  robots: { index: false, follow: false },
};

export default async function AdminNewProductPage() {
  const snapshot = await getAdminCatalogSnapshot();

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            products.write
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            Nuevo producto
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Crea el registro base del producto. Precio, SKU e inventario se gestionan desde variantes y módulos operativos.
          </p>
        </section>
        <AdminProductForm
          mode="create"
          brands={snapshot.brandRows}
          categories={snapshot.categoryRows}
        />
      </div>
    </AdminShell>
  );
}
