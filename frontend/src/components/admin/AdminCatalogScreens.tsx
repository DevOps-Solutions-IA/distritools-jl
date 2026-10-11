import Link from 'next/link';
import { CatalogPermissionProvider } from '@/features/admin/catalog/useCatalogPermissions';
import { CatalogViewPagination, catalogViewPage } from '@/features/admin/catalog/ViewPagination';
import { catalogPermissions } from '@/features/admin/catalog/server';
import { AdminPriceUpdateForm, AdminProductActions } from '@/components/admin/AdminCatalogActions';
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

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin precio';
  return `$ ${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function statusVariant(status: string) {
  if (['READY', 'SELLABLE', 'active'].includes(status)) return 'success' as const;
  if (['NO_GO', 'NOT_SELLABLE', 'OUT_OF_STOCK', 'MISSING_PRICE', 'MISSING_SKU', 'ARCHIVED', 'archived'].includes(status)) return 'danger' as const;
  if (['GO_WITH_RISKS', 'INCOMPLETE', 'MISSING_DIMENSIONS', 'inactive'].includes(status)) return 'warning' as const;
  if (['PARTIAL', 'MISSING_CATEGORY', 'MISSING_BRAND', 'MARGIN_UNAVAILABLE_MISSING_COSTS'].includes(status)) return 'info' as const;
  return 'neutral' as const;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesSearch(row: { name?: string; slug?: string; sku?: string; primarySku?: string | null; product?: string }, search: string) {
  if (!search.trim()) return true;
  const haystack = normalize([row.name, row.slug, row.sku, row.primarySku, row.product].filter(Boolean).join(' '));
  return haystack.includes(normalize(search.trim()));
}

function FilterBar({
  action,
  search,
  status,
  statuses,
  placeholder,
}: {
  action: string;
  search: string;
  status: string;
  statuses: string[];
  placeholder: string;
}) {
  return (
    <form className="grid gap-3 rounded-[1.25rem] border border-[var(--color-border)] bg-[#0d0d0d] p-4 md:grid-cols-[1fr_240px_auto]" action={action}>
      <input
        name="search"
        defaultValue={search}
        placeholder={placeholder}
        className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
      />
      <select
        name="status"
        defaultValue={status}
        className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
      >
        {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <Button type="submit" variant="outline">Filtrar</Button>
    </form>
  );
}

function ProductStatusBadges({ product }: { product: AdminCatalogProductRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={statusVariant(product.status)}>{product.status}</Badge>
      <Badge variant={statusVariant(product.sellability.status)}>{product.sellability.status}</Badge>
      {!product.hasApprovedImage ? <Badge variant="warning">missing_image</Badge> : null}
      {!product.hasDimensions ? <Badge variant="warning">missing_dimensions</Badge> : null}
    </div>
  );
}

export async function AdminProductsScreen({ search = '', status = 'all', page = '1' }: { search?: string; status?: string; page?: string }) {
  const [data, permissions] = await Promise.all([getAdminCatalogOperationsData('30d'), catalogPermissions()]);
  const rows = data.products
    .filter((row) => matchesSearch(row, search))
    .filter((row) => status === 'all' || row.sellability.status === status || row.status === status);
  const pagination = catalogViewPage([...rows].sort((a,b) => a.id.localeCompare(b.id)), page);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#141414,#070707)] p-6 shadow-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">PR Productos</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">Operación de productos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Controla producto, variante, SKU, precio, stock, imagen, dimensiones y vendibilidad desde un flujo completo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(data.readiness.products)}>{data.readiness.products}</Badge>
            {permissions.includes('products.write') ? <Link href="/admin/productos/nuevo"><Button>Nuevo producto completo</Button></Link> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total" value={String(data.metrics.totalProducts ?? 0)} context="Productos reales" />
        <KpiCard title="Activos" value={String(data.metrics.activeProducts ?? 0)} context="Publicables o publicados" />
        <KpiCard title="No vendibles" value={String(data.metrics.notSellableProducts ?? 0)} context="Bloqueo operativo" />
        <KpiCard title="Incompletos" value={String(data.metrics.incompleteProducts ?? 0)} context="Imagen, dimensiones o datos" />
        <KpiCard title="Sin stock" value={String(data.metrics.outOfStockProducts ?? 0)} context="Inventario real" />
      </section>

      <FilterBar
        action="/admin/productos"
        search={search}
        status={status}
        placeholder="Buscar producto, slug o SKU"
        statuses={['all', 'SELLABLE', 'NOT_SELLABLE', 'INCOMPLETE', 'MISSING_PRICE', 'MISSING_SKU', 'MISSING_CATEGORY', 'MISSING_BRAND', 'OUT_OF_STOCK', 'active', 'inactive', 'archived']}
      />

      <CatalogPermissionProvider><section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-base font-semibold text-[var(--color-off-white)]">Productos operativos</h2>
          <Badge variant="neutral">{rows.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              <tr>
                {['Producto', 'SKU/variantes', 'Marca/Categoría', 'Precio', 'Stock', 'Vendibilidad', 'Acciones'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {pagination.rows.map((product) => (
                <tr key={product.id} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex gap-3">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-[var(--color-text-secondary)]">{product.hasApprovedImage ? 'Con imagen' : 'Pendiente'}</div>
                      <div>
                        <Link href={`/admin/productos/${product.id}`} className="font-semibold text-[var(--color-off-white)] hover:text-[var(--color-industrial-yellow)]">{product.name}</Link>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{product.slug}</p>
                        <div className="mt-2"><ProductStatusBadges product={product} /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{product.primarySku ?? 'Sin SKU'}<br />{product.variantsCount} variantes</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{product.brand?.name ?? 'Sin marca'}<br />{product.category?.name ?? 'Sin categoría'}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{money(product.priceFrom)}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{product.availableStock}</td>
                  <td className="px-4 py-4">
                    <p className="max-w-[18rem] text-xs text-[var(--color-text-secondary)]">{[...product.sellability.blockers, ...product.sellability.warnings].join(', ') || 'Sin bloqueadores'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid min-w-[13rem] gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/productos/${product.id}`}>Ver</Link>
                        {permissions.includes('products.write') && permissions.includes('products.read') && permissions.includes('variants.read') ? <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/productos/${product.id}/editar`}>Editar</Link> : null}
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
        <CatalogViewPagination path="/admin/productos" {...pagination} filters={{search, status}} />
        {!rows.length ? <div className="p-5 text-sm text-[var(--color-text-secondary)]">No hay productos para este filtro.</div> : null}
      </section></CatalogPermissionProvider>
    </div>
  );
}

export async function AdminBrandsScreen({ search = '', status = 'all', page = '1' }: { search?: string; status?: string; page?: string }) {
  const [data, permissions] = await Promise.all([getAdminCatalogOperationsData('30d'), catalogPermissions()]);
  const rows = data.brands
    .filter((row) => matchesSearch(row, search))
    .filter((row) => status === 'all' || row.status === status);
  return <TaxonomyScreen type="brand" data={data} rows={rows} search={search} status={status} page={page} permissions={permissions} />;
}

export async function AdminCategoriesScreen({ search = '', status = 'all', page = '1' }: { search?: string; status?: string; page?: string }) {
  const [data, permissions] = await Promise.all([getAdminCatalogOperationsData('30d'), catalogPermissions()]);
  const rows = data.categories
    .filter((row) => matchesSearch(row, search))
    .filter((row) => status === 'all' || row.status === status);
  return <TaxonomyScreen type="category" data={data} rows={rows} search={search} status={status} page={page} permissions={permissions} />;
}

function TaxonomyScreen({
  type,
  data,
  rows,
  search,
  status,
  page,
  permissions,
}: {
  type: 'brand' | 'category';
  data: AdminCatalogData;
  rows: AdminCatalogTaxonomyRow[];
  search: string;
  status: string;
  page: string;
  permissions: string[];
}) {
  const isBrand = type === 'brand';
  const noun = isBrand ? 'marca' : 'categoría';
  const resource = isBrand ? 'brands' : 'categories';
  const pagination = catalogViewPage(rows, page);
  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#101418,#050505)] p-6 shadow-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">{isBrand ? 'MA Marcas' : 'CA Categorías'}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">{isBrand ? 'Identidad de marcas' : 'Estructura de categorías'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {isBrand ? 'Gestiona marcas, estado comercial y productos asociados.' : 'Gestiona jerarquía, padre/hijo y estructura comercial del catálogo.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(isBrand ? data.readiness.brands : data.readiness.categories)}>{isBrand ? data.readiness.brands : data.readiness.categories}</Badge>
            {permissions.includes(`${resource}.write`) ? <Link href={isBrand ? '/admin/marcas/nuevo' : '/admin/categorias/nuevo'}><Button>Nueva {noun}</Button></Link> : null}
          </div>
        </div>
        <CatalogViewPagination path={isBrand ? '/admin/marcas' : '/admin/categorias'} {...pagination} filters={{search, status}} />
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title={isBrand ? 'Marcas' : 'Categorías'} value={String(isBrand ? data.metrics.brandsCount ?? 0 : data.metrics.categoriesCount ?? 0)} context="Registros reales" />
        <KpiCard title="Con productos" value={String(rows.filter((row) => row.productCount > 0).length)} context="Asociación comercial" />
        <KpiCard title="Vendibles" value={String(rows.reduce((sum, row) => sum + row.sellableProductCount, 0))} context="Productos vendibles asociados" />
      </section>
      <FilterBar action={isBrand ? '/admin/marcas' : '/admin/categorias'} search={search} status={status} placeholder={`Buscar ${noun}`} statuses={['all', 'active', 'inactive']} />
      <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-base font-semibold text-[var(--color-off-white)]">{isBrand ? 'Marcas reales' : 'Árbol de categorías'}</h2>
          <Badge variant="neutral">{rows.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              <tr>
                {['Nombre', 'Slug', ...(isBrand ? [] : ['Padre']), 'Estado', 'Productos', 'Vendibles', 'Acciones'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {pagination.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-4 font-semibold text-[var(--color-off-white)]">{row.name}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.slug}</td>
                  {!isBrand ? <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.parent?.name ?? 'Raíz'}</td> : null}
                  <td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.productCount}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.sellableProductCount}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={isBrand ? `/admin/marcas/${row.id}` : `/admin/categorias/${row.id}`}>Ver</Link>
                      {permissions.includes(`${resource}.write`) && permissions.includes(`${resource}.read`) ? <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={isBrand ? `/admin/marcas/${row.id}/editar` : `/admin/categorias/${row.id}/editar`}>Editar</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CatalogViewPagination path={isBrand ? '/admin/marcas' : '/admin/categorias'} {...pagination} filters={{search, status}} />
      </section>
    </div>
  );
}

export async function AdminPricesScreen({ search = '', status = 'all' }: { search?: string; status?: string }) {
  const data = await getAdminCatalogOperationsData('30d');
  const rows = data.prices
    .filter((row) => matchesSearch(row, search))
    .filter((row) => status === 'all' || row.status === status);
  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#17120a,#050505)] p-6 shadow-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">$ Precios</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">Control de precios por SKU</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Cambia precios con motivo obligatorio, historial y auditoría. No se calcula margen si falta costo real.
            </p>
          </div>
          <Badge variant={statusVariant(data.readiness.prices)}>{data.readiness.prices}</Badge>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Variantes" value={String(data.metrics.totalVariants ?? 0)} context="SKUs reales" />
        <KpiCard title="Sin precio" value={String(data.metrics.variantsWithoutPrice ?? 0)} context="Bloquea venta" />
        <KpiCard title="Costo faltante" value={String(data.metrics.missingCostProducts ?? 0)} context="Margen no disponible" />
        <KpiCard title="Cambios" value={String(data.metrics.priceChangesInPeriod ?? 0)} context="Últimos 30 días" />
      </section>
      <FilterBar action="/admin/precios" search={search} status={status} placeholder="Buscar SKU o producto" statuses={['all', 'READY', 'MISSING_PRICE', 'MISSING_SKU', 'INACTIVE']} />
      <PriceTable rows={rows} history={data.priceHistory} />
    </div>
  );
}

function PriceTable({ rows, history }: { rows: AdminCatalogPriceRow[]; history: AdminCatalogData['priceHistory'] }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-base font-semibold text-[var(--color-off-white)]">Precios editables</h2>
          <Badge variant="neutral">{rows.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              <tr>
                {['SKU', 'Producto', 'Precio actual', 'Costo/Margen', 'Stock', 'Estado', 'Acción'].map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-4 font-semibold text-[var(--color-off-white)]"><Link href={`/admin/precios/${row.id}`} className="hover:text-[var(--color-industrial-yellow)]">{row.sku}</Link></td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.product}<br />{row.variant}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{money(row.currentPrice)}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.missingCost ? 'MARGIN_UNAVAILABLE_MISSING_COSTS' : 'Costo configurado'}</td>
                  <td className="px-4 py-4 text-[var(--color-text-secondary)]">{row.availableStock}</td>
                  <td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                  <td className="px-4 py-4"><AdminPriceUpdateForm variantId={row.id} currentPrice={row.currentPrice} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Historial auditado</h2>
        <div className="mt-4 grid gap-2">
          {history.slice(0, 12).map((entry) => (
            <div key={String(entry.id)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-semibold text-[var(--color-off-white)]">{String(entry.action ?? 'variant.price_updated')}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{dateLabel(String(entry.createdAt))}</p>
            </div>
          ))}
          {!history.length ? <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-[var(--color-text-secondary)]">Sin cambios en el rango.</div> : null}
        </div>
      </div>
    </section>
  );
}
