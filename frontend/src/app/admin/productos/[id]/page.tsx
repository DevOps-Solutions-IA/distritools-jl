import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminProductForm } from '@/components/admin/forms/AdminProductForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';
import { getAdminCatalogSnapshot } from '@/lib/admin/operations';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Editar producto admin | DistriTools JL',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditProductPage({ params }: PageProps) {
  const { id } = await params;
  const snapshot = await getAdminCatalogSnapshot();
  const product = snapshot.productRows.find((item) => item.id === id) ?? null;

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            products.write
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            {product ? 'Editar producto' : 'Producto no encontrado'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Los cambios se envían al backend admin y quedan sujetos a RBAC y auditoría.
          </p>
        </section>

        {product ? (
          <AdminProductForm
            mode="edit"
            product={product}
            brands={snapshot.brandRows}
            categories={snapshot.categoryRows}
          />
        ) : (
          <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              No existe un producto con este identificador en el catálogo actual.
            </p>
            <div className="mt-4">
              <Link href="/admin/productos">
                <Button variant="outline">Volver a productos</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
