import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import { getAdminCatalogOperationsData } from '@/lib/admin/server-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Detalle categoría admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminCatalogOperationsData('30d');
  const category = data.categories.find((item) => item.id === id) ?? null;
  const children = data.categories.filter((item) => item.parentId === id);
  const products = data.products.filter((product) => product.category?.id === id);

  return (
    <AdminShell>
      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#14110c,#050505)] p-6 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">CA Categoría</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">{category?.name ?? 'Categoría no encontrada'}</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{category?.parent?.name ? `${category.parent.name} / ` : ''}{category?.slug ?? id}</p>
            </div>
            {category ? <Link href={`/admin/categorias/${category.id}/editar`}><Button>Editar categoría</Button></Link> : null}
          </div>
        </section>
        {category ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <KpiCard title="Productos" value={String(category.productCount)} context="Asociados directos" />
              <KpiCard title="Vendibles" value={String(category.sellableProductCount)} context="Listos para venta" />
              <KpiCard title="Subcategorías" value={String(children.length)} context="Jerarquía real" />
              <KpiCard title="Estado" value={category.status} context="Estructura comercial" />
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <Badge variant={category.status === 'active' ? 'success' : 'warning'}>{category.status}</Badge>
                <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{category.description ?? 'Sin descripción operativa.'}</p>
              </div>
              <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h2 className="text-base font-semibold text-[var(--color-off-white)]">Subcategorías</h2>
                <div className="mt-3 grid gap-2">
                  {children.map((child) => <Link key={child.id} href={`/admin/categorias/${child.id}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-off-white)]">{child.name}</Link>)}
                  {!children.length ? <p className="text-sm text-[var(--color-text-secondary)]">Sin subcategorías.</p> : null}
                </div>
              </div>
            </section>
            <AssociatedProducts rows={products} />
          </>
        ) : <NotFoundBack href="/admin/categorias" />}
      </div>
    </AdminShell>
  );
}

function AssociatedProducts({ rows }: { rows: Array<{ id: string; name: string; primarySku: string | null; sellability: { status: string } }> }) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Productos asociados</h2>
        <Badge variant="neutral">{rows.length}</Badge>
      </div>
      <div className="divide-y divide-white/10">
        {rows.slice(0, 20).map((product) => (
          <Link key={product.id} href={`/admin/productos/${product.id}`} className="grid gap-1 px-4 py-3 text-sm hover:bg-white/[0.03]">
            <span className="font-semibold text-[var(--color-off-white)]">{product.name}</span>
            <span className="text-[var(--color-text-secondary)]">{product.primarySku ?? 'Sin SKU'} · {product.sellability.status}</span>
          </Link>
        ))}
        {!rows.length ? <p className="p-5 text-sm text-[var(--color-text-secondary)]">No hay productos asociados.</p> : null}
      </div>
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
