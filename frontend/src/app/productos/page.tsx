import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { ErrorState } from '@/components/ui/ErrorState';
import { filterCatalogProducts } from '@/features/catalog/filtering';
import { getProductListingData } from '@/features/catalog/queries';
import { isPubliclyPurchasable } from '@/features/catalog/live-search';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: `Productos industriales | ${siteConfig.name}`,
  description:
    'Compra herramientas, compresores, soldadura, fijación y soluciones industriales en DistriTools JL.',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  try {
    const resolvedSearchParams = (await searchParams) ?? {};
    const brandSlug = getSingleValue(resolvedSearchParams.brand);
    const categorySlug = getSingleValue(resolvedSearchParams.category);
    const query = getSingleValue(resolvedSearchParams.q);
    const status = getSingleValue(resolvedSearchParams.status);
    const sort = getSingleValue(resolvedSearchParams.sort);

    const { data } = await getProductListingData({ brandSlug, categorySlug, sort });
    const publicProducts = data.products.filter(isPubliclyPurchasable);
    const filteredProducts = filterCatalogProducts(data.products, {
      query,
      brandSlug,
      categorySlug,
      status,
      sort,
    });

    return (
      <StorefrontShell>
        <section className="space-y-4 sm:space-y-6 lg:space-y-7">
          <Breadcrumbs className="hidden sm:block" items={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]} />
          <CatalogHeader
            eyebrow="Productos"
            title="Productos industriales"
            description="Herramientas y equipos en stock para comprar directo."
            stats={[]}
            primaryHref="/marcas"
            primaryLabel="Ver marcas"
            secondaryHref="/buscar"
            secondaryLabel="Buscar"
          />
          <CatalogToolbar
            action="/productos"
            clearHref="/productos"
            brands={data.brands}
            categories={data.categories}
            products={publicProducts}
            resultCount={filteredProducts.length}
            query={query}
            selectedBrandSlug={data.appliedFilters.brandSlug}
            selectedCategorySlug={data.appliedFilters.categorySlug}
            selectedStatus={status}
            selectedSort={data.appliedFilters.sort}
          />
          <ProductGrid products={filteredProducts} />
          <div className="text-sm text-[var(--color-text-secondary)]">
            ¿No encuentras una referencia?{' '}
            <Link href="/buscar" className="font-semibold text-[var(--color-industrial-yellow)]">
              Usa la búsqueda
            </Link>{' '}
            o solicita asesoría.
          </div>
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar productos"
          description={error instanceof Error ? error.message : 'El catálogo no respondió correctamente.'}
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
