import type { Metadata } from 'next';
import { AdminTaxonomyForm } from '@/components/admin/forms/AdminTaxonomyForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nueva categoría admin | DistriTools JL',
  robots: { index: false, follow: false },
};

export default async function AdminNewCategoryPage() {
  const data = await getAdminCatalogOperationsData('30d');
  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            categories.write
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            Nueva categoría
          </h1>
        </section>
        <AdminTaxonomyForm kind="category" categories={data.categories} />
      </div>
    </AdminShell>
  );
}
