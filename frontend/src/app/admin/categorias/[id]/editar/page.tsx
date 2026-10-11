import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminTaxonomyForm } from '@/components/admin/forms/AdminTaxonomyForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';
import { catalogRead, catalogCollection, type CatalogCategoryRecord } from '@/features/admin/catalog/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Editar categoría admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [category, categories] = await Promise.all([catalogRead<CatalogCategoryRecord>(`/admin/categories/${id}`), catalogCollection<CatalogCategoryRecord>('/admin/categories')]);
  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">categories.write</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">{category ? `Editar ${category.name}` : 'Categoría no encontrada'}</h1>
        </section>
        {category ? (
          <AdminTaxonomyForm
            kind="category"
            mode="edit"
            initial={category}
            categories={categories}
          />
        ) : <Link href="/admin/categorias"><Button variant="outline">Volver</Button></Link>}
      </div>
    </AdminShell>
  );
}
