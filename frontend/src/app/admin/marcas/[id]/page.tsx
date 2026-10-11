import type { Metadata } from 'next';
import { catalogPermissions } from '@/features/admin/catalog/server';
import { CatalogViewPagination, catalogViewPage } from '@/features/admin/catalog/ViewPagination';
import Link from 'next/link';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Detalle marca admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminBrandDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { id } = await params;
  const page = (await searchParams)?.page ?? '1';
  const [data, permissions] = await Promise.all([getAdminCatalogOperationsData('30d'), catalogPermissions()]);
  const brand = data.brands.find((item) => item.id === id) ?? null;
  const products = data.products.filter((product) => product.brand?.id === id);

  return (
    <AdminShell>
      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#101418,#050505)] p-6 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">MA Marca</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">{brand?.name ?? 'Marca no encontrada'}</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{brand?.slug ?? id}</p>
            </div>
            {brand && permissions.includes('brands.write') && permissions.includes('brands.read') ? <Link href={`/admin/marcas/${brand.id}/editar`}><Button>Editar marca</Button></Link> : null}
          </div>
        </section>
        {brand ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <KpiCard title="Productos" value={String(brand.productCount)} context="Asociados" />
              <KpiCard title="Vendibles" value={String(brand.sellableProductCount)} context="Listos para venta" />
              <KpiCard title="Estado" value={brand.status} context="Identidad comercial" />
            </section>
            <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex flex-wrap gap-2"><Badge variant={brand.status === 'active' ? 'success' : 'warning'}>{brand.status}</Badge></div>
              <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{brand.description ?? 'Sin descripción operativa.'}</p>
            </section>
            <AssociatedProducts rows={products} requested={page} path={`/admin/marcas/${id}`} />
          </>
        ) : <NotFoundBack href="/admin/marcas" />}
      </div>
    </AdminShell>
  );
}

function AssociatedProducts({ rows, requested, path }: { requested: string; path: string; rows: Array<{ id: string; name: string; primarySku: string | null; sellability: { status: string } }> }) {
  const pagination = catalogViewPage([...rows].sort((a, b) => a.id.localeCompare(b.id)), requested);
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Productos asociados</h2>
        <Badge variant="neutral">{rows.length}</Badge>
      </div>
      <div className="divide-y divide-white/10">
        {pagination.rows.map((product) => (
          <Link key={product.id} href={`/admin/productos/${product.id}`} className="grid gap-1 px-4 py-3 text-sm hover:bg-white/[0.03]">
            <span className="font-semibold text-[var(--color-off-white)]">{product.name}</span>
            <span className="text-[var(--color-text-secondary)]">{product.primarySku ?? 'Sin SKU'} · {product.sellability.status}</span>
          </Link>
        ))}
        {!rows.length ? <p className="p-5 text-sm text-[var(--color-text-secondary)]">No hay productos asociados.</p> : null}
      </div>
      <CatalogViewPagination path={path} {...pagination} />
    </section>
  );
}

function NotFoundBack({ href }: { href: string }) {
  return (
    <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-6">
      <p className="text-sm text-[var(--color-text-secondary)]">Registro no encontrado.</p>
      <div className="mt-4"><Link href={href}><Button variant="outline">Volver</Button></Link></div>
    </section>
  );
}
