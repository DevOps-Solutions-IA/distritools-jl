import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductFilters } from '@/components/catalog/ProductFilters';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { ProductSearchBar } from '@/components/catalog/ProductSearchBar';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { getProductListingData } from '@/features/catalog/queries';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: `${siteConfig.name} | Productos`,
  description:
    'Explora el catálogo de DistriTools JL por marca, categoría y línea técnica.',
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
    const sort = getSingleValue(resolvedSearchParams.sort);

    const { data } = await getProductListingData({
      brandSlug,
      categorySlug,
      sort,
    });

    return (
      <StorefrontShell>
        <section className="space-y-8">
          <div className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#101010_0%,#0b0b0b_100%)] p-8 shadow-elevated">
            <div className="space-y-4">
              <Badge variant="default">Catálogo industrial</Badge>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-off-white)]">
                    Catálogo organizado por marca, categoría y familia técnica
                  </h1>
                  <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
                    Explora el portafolio visible con filtros claros para encontrar más rápido la referencia correcta.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm font-semibold">
                  <Link href="/storefront/buscar" className="text-[var(--color-industrial-yellow)]">
                    Ir a búsqueda
                  </Link>
                  <Link href="/storefront/marcas" className="text-[var(--color-text-secondary)]">
                    Explorar marcas
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                `${data.products.length} referencias visibles`,
                `${data.categories.length} categorías activas`,
                `${data.brands.length} marcas disponibles`,
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-medium text-[var(--color-off-white)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <ProductSearchBar action="/storefront/buscar" />

          <ProductFilters
            brands={data.brands}
            categories={data.categories}
            selectedBrandSlug={data.appliedFilters.brandSlug}
            selectedCategorySlug={data.appliedFilters.categorySlug}
            selectedSort={data.appliedFilters.sort}
          />
          <ProductGrid products={data.products} />
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar el catálogo"
          description={
            error instanceof Error
              ? error.message
              : 'El listado público de productos no respondió correctamente.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
