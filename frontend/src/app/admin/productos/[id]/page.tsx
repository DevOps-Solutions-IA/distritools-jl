import type { Metadata } from 'next';
import { catalogPermissions } from '@/features/admin/catalog/server';
import Link from 'next/link';
import { AdminProductActions } from '@/components/admin/AdminCatalogActions';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Detalle producto admin | DistriTools JL',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Sin precio';
  return `$ ${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function statusVariant(status: string) {
  if (['SELLABLE', 'active', 'READY'].includes(status)) return 'success' as const;
  if (['NOT_SELLABLE', 'OUT_OF_STOCK', 'MISSING_PRICE', 'MISSING_SKU', 'archived'].includes(status)) return 'danger' as const;
  if (['INCOMPLETE', 'MISSING_DIMENSIONS', 'inactive'].includes(status)) return 'warning' as const;
  return 'neutral' as const;
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [data, permissions] = await Promise.all([getAdminCatalogOperationsData('30d'), catalogPermissions()]);
  const product = data.products.find((item) => item.id === id) ?? null;
  const prices = data.prices.filter((item) => item.productId === id);
  const blockers = product ? [...product.sellability.blockers, ...product.sellability.warnings] : [];

  return (
    <AdminShell>
      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#151515,#060606)] p-6 shadow-elevated">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">PR Producto</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
                {product?.name ?? 'Producto no encontrado'}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{product?.slug ?? id}</p>
            </div>
            {product ? (
              <div className="flex flex-wrap gap-2">
                {permissions.includes('products.write') && permissions.includes('products.read') ? <Link href={`/admin/productos/${product.id}/editar`}><Button>{permissions.includes('variants.read') ? 'Editar' : 'Gestionar imagen'}</Button></Link> : null}
                <Link href={`/admin/inventario?sku=${encodeURIComponent(product.primarySku ?? '')}`}><Button variant="outline">Ver inventario</Button></Link>
                {permissions.includes('products.write') && permissions.includes('products.read') && permissions.includes('variants.read') ? <Link href={`/admin/productos/${product.id}/editar?variant=new`}><Button variant="outline">Agregar variante</Button></Link> : null}
                <Link href="/admin/precios"><Button variant="outline">Ver precios</Button></Link>
              </div>
            ) : null}
          </div>
        </section>

        {product ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Vendibilidad" value={product.sellability.status} context={product.sellability.sellable ? 'Vendible' : 'Bloqueado o incompleto'} />
              <KpiCard title="Precio desde" value={money(product.priceFrom)} context={product.primarySku ?? 'Sin SKU principal'} />
              <KpiCard title="Stock disponible" value={String(product.availableStock)} context="Inventario real consolidado" />
              <KpiCard title="Variantes" value={String(product.variantsCount)} context={`${product.activeVariantsCount} activas`} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
                <div className="grid h-56 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-[var(--color-text-secondary)]">
                  {product.hasApprovedImage ? 'Imagen principal configurada' : 'missing_main_image'}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={statusVariant(product.status)}>{product.status}</Badge>
                  <Badge variant={statusVariant(product.sellability.status)}>{product.sellability.status}</Badge>
                  <Badge variant={product.hasDimensions ? 'success' : 'warning'}>{product.hasDimensions ? 'dimensions_ok' : 'missing_dimensions'}</Badge>
                </div>
              </div>

              <div className="grid gap-4">
                <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[var(--color-off-white)]">Bloqueadores de vendibilidad</h2>
                  <div className="mt-4 grid gap-2">
                    {blockers.length ? blockers.map((item) => (
                      <p key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{item}</p>
                    )) : <p className="text-sm text-[var(--color-text-secondary)]">Sin bloqueadores registrados.</p>}
                  </div>
                </section>
                <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[var(--color-off-white)]">Relación comercial</h2>
                  <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
                    <p><span className="text-[var(--color-off-white)]">Marca:</span> {product.brand?.name ?? 'Sin marca'}</p>
                    <p><span className="text-[var(--color-off-white)]">Categoría:</span> {product.category?.name ?? 'Sin categoría'}</p>
                    <p><span className="text-[var(--color-off-white)]">SKU:</span> {product.primarySku ?? 'Sin SKU'}</p>
                    <p><span className="text-[var(--color-off-white)]">Actualizado:</span> {new Date(product.updatedAt).toLocaleString('es-CO')}</p>
                  </div>
                </section>
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <h2 className="text-base font-semibold text-[var(--color-off-white)]">Variantes, precios e inventario</h2>
                <Badge variant="neutral">{prices.length}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[780px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                    <tr>
                      {['SKU', 'Variante', 'Precio', 'Stock', 'Costo/Margen', 'Acción'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {prices.map((price) => (
                      <tr key={price.id}>
                        <td className="px-4 py-3 font-semibold text-[var(--color-off-white)]">{price.sku}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{price.variant}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{money(Number(price.currentPrice))}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{price.availableStock}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{price.missingCost ? 'MARGIN_UNAVAILABLE_MISSING_COSTS' : 'Costo configurado'}</td>
                        <td className="px-4 py-3"><Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/precios/${price.id}`}>Historial precio</Link>{permissions.includes('products.write') && permissions.includes('products.read') && permissions.includes('variants.read') ? <><br /><Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/productos/${product.id}/editar?variant=${encodeURIComponent(price.id)}`}>Editar variante</Link></> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!prices.length ? <p className="p-5 text-sm text-[var(--color-text-secondary)]">Sin variantes/precios asociados.</p> : null}
            </section>

            <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--color-off-white)]">Acciones auditadas</h2>
              <div className="mt-4">
                <AdminProductActions productId={product.id} isActive={product.isActive} />
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-6">
            <p className="text-sm text-[var(--color-text-secondary)]">No existe un producto con este identificador.</p>
            <div className="mt-4"><Link href="/admin/productos"><Button variant="outline">Volver a productos</Button></Link></div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
