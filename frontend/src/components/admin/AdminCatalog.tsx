import Link from 'next/link';
import { AdminProductActions, AdminPriceUpdateForm } from '@/components/admin/AdminCatalogActions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import {
  type AdminCatalogData,
  type AdminCatalogPriceRow,
  type AdminCatalogProductRow,
  type AdminCatalogTaxonomyRow,
  getAdminCatalogOperationsData,
} from '@/lib/admin/server-data';

type CatalogMode = 'overview' | 'products' | 'brands' | 'categories' | 'prices';

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 'Sin precio';
  return `$ ${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function statusVariant(status: string) {
  if (['READY', 'SELLABLE', 'active'].includes(status)) return 'success' as const;
  if (['NO_GO', 'NOT_SELLABLE', 'OUT_OF_STOCK', 'MISSING_PRICE', 'MISSING_SKU', 'ARCHIVED', 'archived'].includes(status)) return 'danger' as const;
  if (['GO_WITH_RISKS', 'INCOMPLETE', 'MISSING_DIMENSIONS', 'inactive'].includes(status)) return 'warning' as const;
  if (['PARTIAL', 'MISSING_CATEGORY', 'MISSING_BRAND'].includes(status)) return 'info' as const;
  return 'neutral' as const;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesSearch(row: { name?: string; slug?: string; sku?: string; product?: string }, search: string) {
  if (!search.trim()) return true;
  const haystack = normalize([row.name, row.slug, row.sku, row.product].filter(Boolean).join(' '));
  return haystack.includes(normalize(search.trim()));
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value === null || value === undefined || value === '') return 'Sin detalle';
  return String(value);
}

function CatalogHeader({ data, mode }: { data: AdminCatalogData; mode: CatalogMode }) {
  const moduleStatus =
    mode === 'products' ? data.readiness.products
      : mode === 'brands' ? data.readiness.brands
        : mode === 'categories' ? data.readiness.categories
          : mode === 'prices' ? data.readiness.prices
            : data.readiness.status;

  return (
    <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111111_0%,#0b0b0b_100%)] p-5 shadow-elevated">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">Catálogo operativo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            Productos, marcas, categorías, inventario y precios
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Datos reales · actualizado {dateLabel(data.generatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(moduleStatus)}>{moduleStatus}</Badge>
          {(mode === 'overview' || mode === 'products') ? (
            <Link href="/admin/productos/nuevo">
              <Button>Nuevo producto</Button>
            </Link>
          ) : null}
          <Link href="/admin/reportes?tab=inventory">
            <Button variant="outline">Ver reportes</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function CatalogNav({ mode }: { mode: CatalogMode }) {
  const tabs = [
    ['overview', 'Resumen', '/admin/productos'],
    ['products', 'Productos', '/admin/productos?tab=products'],
    ['brands', 'Marcas', '/admin/marcas'],
    ['categories', 'Categorías', '/admin/categorias'],
    ['prices', 'Precios', '/admin/precios'],
  ] as const;
  return (
    <nav className="flex gap-2 overflow-x-auto rounded-[1.25rem] border border-[var(--color-border)] bg-[#0d0d0d] p-2" aria-label="Catálogo">
      {tabs.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
            mode === key ? 'bg-[var(--color-industrial-yellow)] text-[#050505]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-off-white)]'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Metrics({ data }: { data: AdminCatalogData }) {
  const items = [
    ['Productos', data.metrics.totalProducts ?? 0, `${data.metrics.sellableProducts ?? 0} vendibles`],
    ['No vendibles', data.metrics.notSellableProducts ?? 0, `${data.metrics.incompleteProducts ?? 0} incompletos`],
    ['Variantes', data.metrics.totalVariants ?? 0, `${data.metrics.variantsWithoutSku ?? 0} sin SKU`],
    ['Sin precio', data.metrics.variantsWithoutPrice ?? 0, 'Bloquea venta'],
    ['Sin stock', data.metrics.outOfStockProducts ?? 0, `${data.metrics.lowStockProducts ?? 0} bajo stock`],
    ['Cambios precio', data.metrics.priceChangesInPeriod ?? 0, 'Rango actual'],
  ];
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([title, value, context]) => <KpiCard key={title} title={String(title)} value={String(value)} context={String(context)} />)}
    </section>
  );
}

function Readiness({ data }: { data: AdminCatalogData }) {
  const modules = [
    ['Productos', data.readiness.products],
    ['Marcas', data.readiness.brands],
    ['Categorías', data.readiness.categories],
    ['Inventario', data.readiness.inventory],
    ['Precios', data.readiness.prices],
  ];
  return (
    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Readiness catálogo</h2>
        <div className="mt-4 grid gap-2">
          {modules.map(([label, status]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
              <Badge variant={statusVariant(status)}>{status}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-off-white)]">Bloqueadores y advertencias</h2>
          <Badge variant={data.readiness.blockers.length ? 'danger' : data.readiness.warnings.length ? 'warning' : 'success'}>
            {data.readiness.blockers.length + data.readiness.warnings.length}
          </Badge>
        </div>
        <div className="mt-4 grid gap-2">
          {[...data.readiness.blockers, ...data.readiness.warnings].slice(0, 8).map((item, index) => (
            <Link key={index} href={String(item.href ?? '/admin/productos')} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="font-semibold text-[var(--color-off-white)]">{String(item.entity ?? item.module)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{listValue(item.blockers ?? item.warnings)}</p>
            </Link>
          ))}
          {!data.readiness.blockers.length && !data.readiness.warnings.length ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
              Sin bloqueadores de catálogo.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProductsTable({ rows }: { rows: AdminCatalogProductRow[] }) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Productos</h2>
        <Badge variant="neutral">{rows.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            <tr>
              {['Producto', 'SKU/variantes', 'Marca', 'Categoría', 'Precio', 'Stock', 'Vendibilidad', 'Acciones'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((product) => (
              <tr key={product.id} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/admin/productos/${product.id}`} className="font-semibold text-[var(--color-off-white)] hover:text-[var(--color-industrial-yellow)]">{product.name}</Link>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{product.slug}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant={statusVariant(product.status)}>{product.status}</Badge>
                    {!product.hasApprovedImage ? <Badge variant="warning">Sin imagen</Badge> : null}
                    {!product.hasDimensions ? <Badge variant="warning">Sin dimensiones</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{product.primarySku ?? 'Sin SKU'} · {product.variantsCount}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{product.brand?.name ?? 'Sin marca'}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{product.category?.name ?? 'Sin categoría'}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{money(product.priceFrom)}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{product.availableStock}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(product.sellability.status)}>{product.sellability.status}</Badge>
                  <p className="mt-2 max-w-[18rem] text-xs text-[var(--color-text-secondary)]">
                    {[...product.sellability.blockers, ...product.sellability.warnings].join(', ') || 'Sin bloqueadores'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/productos/${product.id}`}>Detalle</Link>
                      <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/productos/${product.slug}`}>Storefront</Link>
                      <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/inventario?sku=${encodeURIComponent(product.primarySku ?? '')}`}>Inventario</Link>
                    </div>
                    <AdminProductActions productId={product.id} isActive={product.isActive} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div className="p-5 text-sm text-[var(--color-text-secondary)]">Sin productos para este filtro.</div> : null}
    </section>
  );
}

function TaxonomyTable({ title, rows, kind }: { title: string; rows: AdminCatalogTaxonomyRow[]; kind: 'marca' | 'categoría' }) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">{title}</h2>
        <Link href={kind === 'marca' ? '/admin/marcas/nuevo' : '/admin/categorias/nuevo'}>
          <Button size="sm">Nueva {kind}</Button>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            <tr>
              {['Nombre', 'Slug', 'Padre', 'Estado', 'Productos', 'Vendibles', 'Actualizado'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold text-[var(--color-off-white)]">{row.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.slug}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.parent?.name ?? 'N/A'}</td>
                <td className="px-4 py-3"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.productCount}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.sellableProductCount}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{dateLabel(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PricesTable({ rows, history }: { rows: AdminCatalogPriceRow[]; history: AdminCatalogData['priceHistory'] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-base font-semibold text-[var(--color-off-white)]">Precios por SKU</h2>
          <Badge variant="info">MARGIN_UNAVAILABLE_MISSING_COSTS si falta costo</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              <tr>
                {['SKU', 'Producto', 'Precio', 'Stock', 'Costo', 'Estado', 'Cambio'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3 font-semibold text-[var(--color-off-white)]">{row.sku}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.product}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{money(row.currentPrice)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.availableStock}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.missingCost ? 'Costo no configurado' : 'Costo configurado'}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                  <td className="px-4 py-3"><AdminPriceUpdateForm variantId={row.id} currentPrice={row.currentPrice} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Historial reciente</h2>
        <div className="mt-4 grid gap-2">
          {history.slice(0, 10).map((entry) => (
            <div key={String(entry.id)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <p className="font-semibold text-[var(--color-off-white)]">{String(entry.action ?? 'price_change')}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{dateLabel(String(entry.createdAt))}</p>
            </div>
          ))}
          {!history.length ? <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-[var(--color-text-secondary)]">Sin cambios de precio en el rango.</div> : null}
        </div>
      </div>
    </section>
  );
}

export async function AdminCatalog({ mode = 'overview', search = '', status = 'all' }: { mode?: CatalogMode; search?: string; status?: string }) {
  const data = await getAdminCatalogOperationsData('30d');
  const productRows = data.products
    .filter((row) => matchesSearch(row, search))
    .filter((row) => status === 'all' || row.sellability.status === status || row.status === status);
  const priceRows = data.prices
    .filter((row) => matchesSearch(row, search))
    .filter((row) => status === 'all' || row.status === status);

  return (
    <div className="space-y-5">
      <CatalogHeader data={data} mode={mode} />
      <CatalogNav mode={mode} />

      <form className="grid gap-3 rounded-[1.25rem] border border-[var(--color-border)] bg-[#0d0d0d] p-3 md:grid-cols-[1fr_220px_auto]" action={mode === 'prices' ? '/admin/precios' : mode === 'brands' ? '/admin/marcas' : mode === 'categories' ? '/admin/categorias' : '/admin/productos'}>
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar producto, SKU, marca o categoría"
          className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
        />
        <select
          name="status"
          defaultValue={status}
          className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
        >
          {['all', 'SELLABLE', 'INCOMPLETE', 'MISSING_PRICE', 'MISSING_SKU', 'MISSING_CATEGORY', 'MISSING_BRAND', 'OUT_OF_STOCK', 'active', 'inactive', 'archived'].map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>

      <Metrics data={data} />
      <Readiness data={data} />

      {mode === 'brands' ? <TaxonomyTable title="Marcas" rows={data.brands.filter((row) => matchesSearch(row, search))} kind="marca" /> : null}
      {mode === 'categories' ? <TaxonomyTable title="Categorías" rows={data.categories.filter((row) => matchesSearch(row, search))} kind="categoría" /> : null}
      {mode === 'prices' ? <PricesTable rows={priceRows} history={data.priceHistory} /> : null}
      {mode === 'overview' || mode === 'products' ? (
        <ProductsTable rows={productRows} />
      ) : null}
    </div>
  );
}
