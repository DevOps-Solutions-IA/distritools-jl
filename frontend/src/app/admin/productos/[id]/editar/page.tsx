import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminProductCompleteForm } from '@/components/admin/forms/AdminProductCompleteForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';
import { getAdminCatalogSnapshot } from '@/lib/admin/operations';
import { getAdminCatalogOperationsData, getAdminOperationalSnapshot } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Editar producto completo admin | DistriTools JL',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductEditPage({ params }: PageProps) {
  const { id } = await params;
  const [snapshot, catalog, operations] = await Promise.all([
    getAdminCatalogSnapshot(),
    getAdminCatalogOperationsData('30d'),
    getAdminOperationalSnapshot(),
  ]);
  const product = snapshot.productRows.find((item) => item.id === id) ?? null;
  const operationalProduct = catalog.products.find((item) => item.id === id) ?? null;
  const primaryVariant = snapshot.variantRows.find((variant) => variant.productId === id) ?? null;

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">products.write</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            {product ? `Editar ${product.name}` : 'Producto no encontrado'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Edita datos comerciales, variante principal, precio, costo y reglas logísticas. La activación vuelve a validar vendibilidad en backend.
          </p>
        </section>

        {product ? (
          <AdminProductCompleteForm
            mode="edit"
            product={{ ...product, isActive: operationalProduct?.isActive ?? false }}
            primaryVariant={primaryVariant}
            brands={snapshot.brandRows}
            categories={snapshot.categoryRows}
            warehouses={operations.inventoryWarehouses.data.map((warehouse) => ({
              id: String(warehouse.id),
              name: warehouse.name ? String(warehouse.name) : undefined,
              code: warehouse.code ? String(warehouse.code) : undefined,
            }))}
          />
        ) : (
          <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-6">
            <p className="text-sm text-[var(--color-text-secondary)]">No existe un producto con este identificador.</p>
            <div className="mt-4"><Link href="/admin/productos"><Button variant="outline">Volver</Button></Link></div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
