import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminTaxonomyForm } from '@/components/admin/forms/AdminTaxonomyForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Editar marca admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminBrandEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminCatalogOperationsData('30d');
  const brand = data.brands.find((item) => item.id === id) ?? null;
  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">brands.write</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">{brand ? `Editar ${brand.name}` : 'Marca no encontrada'}</h1>
        </section>
        {brand ? <AdminTaxonomyForm kind="brand" mode="edit" initial={{ ...brand, isActive: brand.status === 'active' }} /> : <Link href="/admin/marcas"><Button variant="outline">Volver</Button></Link>}
      </div>
    </AdminShell>
  );
}
