import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminProductForm } from '@/components/admin/forms/AdminProductForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import { getAdminCatalogSnapshot } from '@/lib/admin/operations';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

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
  const [snapshot, operations] = await Promise.all([
    getAdminCatalogSnapshot(),
    getAdminCatalogOperationsData('30d'),
  ]);
  const product = snapshot.productRows.find((item) => item.id === id) ?? null;
  const operationalProduct = operations.products.find((item) => item.id === id) ?? null;
  const effectiveProduct = product
    ? { ...product, isActive: operationalProduct?.isActive ?? true }
    : null;

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

        {effectiveProduct ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Vendibilidad"
                value={operationalProduct?.sellability.status ?? 'NO_DATA'}
                context={operationalProduct?.sellability.sellable ? 'Producto vendible' : 'Requiere corrección'}
              />
              <KpiCard title="Stock disponible" value={String(operationalProduct?.availableStock ?? 0)} context="Desde inventario real" />
              <KpiCard title="Precio desde" value={operationalProduct?.priceFrom === null ? 'Sin precio' : `$ ${Number(operationalProduct?.priceFrom ?? 0).toLocaleString('es-CO')}`} context="Por variante/SKU" />
              <KpiCard title="Variantes activas" value={String(operationalProduct?.activeVariantsCount ?? 0)} context={`${operationalProduct?.variantsCount ?? 0} variantes totales`} />
            </section>

            <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={operationalProduct?.sellability.sellable ? 'success' : 'warning'}>
                  {operationalProduct?.sellability.status ?? 'NO_DATA'}
                </Badge>
                {operationalProduct?.hasApprovedImage ? null : <Badge variant="warning">missing_main_image</Badge>}
                {operationalProduct?.hasDimensions ? null : <Badge variant="warning">missing_dimensions</Badge>}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                {[
                  ...(operationalProduct?.sellability.blockers ?? []),
                  ...(operationalProduct?.sellability.warnings ?? []),
                ].map((item) => (
                  <p key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    {item}
                  </p>
                ))}
                {operationalProduct?.sellability.blockers.length || operationalProduct?.sellability.warnings.length ? null : (
                  <p>Sin bloqueadores registrados.</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/admin/inventario?sku=${encodeURIComponent(operationalProduct?.primarySku ?? '')}`}>
                  <Button variant="outline">Ver inventario</Button>
                </Link>
                <Link href="/admin/precios">
                  <Button variant="outline">Ver precios</Button>
                </Link>
              </div>
            </section>

            <AdminProductForm
              mode="edit"
              product={effectiveProduct}
              brands={snapshot.brandRows}
              categories={snapshot.categoryRows}
            />
          </>
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
