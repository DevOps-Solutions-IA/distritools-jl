import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPriceUpdateForm } from '@/components/admin/AdminCatalogActions';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Historial precio admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminPriceDetailPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  const data = await getAdminCatalogOperationsData('30d');
  const price = data.prices.find((item) => item.id === variantId) ?? null;
  const history = data.priceHistory.filter((item) => String(item.variantId ?? item.entityId ?? '') === variantId);

  return (
    <AdminShell>
      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#17120a,#050505)] p-6 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">$ Precio</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">{price?.sku ?? 'Precio no encontrado'}</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{price ? `${price.product} · ${price.variant}` : variantId}</p>
            </div>
            <Link href="/admin/precios"><Button variant="outline">Volver a precios</Button></Link>
          </div>
        </section>
        {price ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <KpiCard title="Precio actual" value={`$ ${Number(price.currentPrice).toLocaleString('es-CO')}`} context={price.currency} />
              <KpiCard title="Stock" value={String(price.availableStock)} context="Disponible" />
              <KpiCard title="Margen" value={price.missingCost ? 'NO_DATA' : 'Configurado'} context={price.missingCost ? 'MARGIN_UNAVAILABLE_MISSING_COSTS' : 'Costo real configurado'} />
              <KpiCard title="Cambios" value={String(history.length)} context="Historial auditado" />
            </section>
            <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
                <h2 className="text-lg font-semibold text-[var(--color-off-white)]">Cambiar precio</h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Requiere prices.write y motivo obligatorio. El backend bloquea precio menor o igual a cero.</p>
                <div className="mt-4"><AdminPriceUpdateForm variantId={price.id} currentPrice={price.currentPrice} /></div>
              </div>
              <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h2 className="text-lg font-semibold text-[var(--color-off-white)]">Contexto SKU</h2>
                <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-secondary)]">
                  <p><span className="text-[var(--color-off-white)]">Producto:</span> <Link href={`/admin/productos/${price.productId}`} className="text-[var(--color-industrial-yellow)] hover:underline">{price.product}</Link></p>
                  <p><span className="text-[var(--color-off-white)]">Estado:</span> <Badge>{price.status}</Badge></p>
                  <p><span className="text-[var(--color-off-white)]">Costo:</span> {price.missingCost ? 'MARGIN_UNAVAILABLE_MISSING_COSTS' : 'Configurado'}</p>
                </div>
              </div>
            </section>
            <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <h2 className="text-base font-semibold text-[var(--color-off-white)]">Historial de cambios</h2>
                <Badge variant="neutral">{history.length}</Badge>
              </div>
              <div className="divide-y divide-white/10">
                {history.map((entry) => (
                  <div key={String(entry.id)} className="grid gap-1 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-off-white)]">{String(entry.action ?? 'variant.price_updated')}</span>
                    <span>{new Date(String(entry.createdAt)).toLocaleString('es-CO')}</span>
                    <span>{JSON.stringify(entry.afterData ?? {})}</span>
                  </div>
                ))}
                {!history.length ? <p className="p-5 text-sm text-[var(--color-text-secondary)]">Sin cambios auditados en el rango.</p> : null}
              </div>
            </section>
          </>
        ) : <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-6 text-sm text-[var(--color-text-secondary)]">No existe esta variante en precios.</section>}
      </div>
    </AdminShell>
  );
}
