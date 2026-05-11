import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductSearchBar } from '@/components/catalog/ProductSearchBar';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getProductListingData } from '@/features/catalog/queries';
import { getLiveSearchResults, normalizeSearchText } from '@/features/catalog/live-search';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: `Buscar productos | ${siteConfig.name}`,
  description: 'Busca productos, marcas y categorías en DistriTools JL.',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  try {
    const resolvedSearchParams = (await searchParams) ?? {};
    const query = getSingleValue(resolvedSearchParams.q) ?? '';
    const { data } = await getProductListingData({});
    const liveResults = getLiveSearchResults({
      query,
      products: data.products,
      brands: data.brands,
      categories: data.categories,
      limit: 12,
    });
    const hasQuery = normalizeSearchText(query).length >= 2;

    return (
      <StorefrontShell>
        <section className="space-y-5 sm:space-y-8">
          <div className="space-y-3">
            <Badge variant="default">Búsqueda</Badge>
            <h1 className="text-3xl font-semibold text-[var(--color-off-white)] sm:text-4xl">Encuentra rápido</h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
              Busca productos con precio y stock por nombre, marca, categoría o referencia.
            </p>
          </div>
          <ProductSearchBar
            action="/buscar"
            defaultValue={query}
            products={data.products}
            brands={data.brands}
            categories={data.categories}
          />
          {!hasQuery ? (
            <EmptyState title="Escribe una búsqueda" description="Puedes buscar taladro, soldadora, compresor, marca o SKU." />
          ) : liveResults.products.length ? (
            <div className="grid gap-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {liveResults.products.length} productos en stock para <strong>{query}</strong>
              </p>
              <ProductGrid products={liveResults.products} />
              {(liveResults.brands.length || liveResults.categories.length) ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {liveResults.brands.map((brand) => (
                    <Link key={brand.id} href={`/marcas/${brand.slug}`}>
                      <Card variant="elevated" className="transition hover:-translate-y-0.5 hover:shadow-medium">
                        <CardBody className="p-4">
                          <Badge variant="neutral">Marca</Badge>
                          <h2 className="mt-2 text-lg font-semibold text-[var(--color-off-white)]">{brand.name}</h2>
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
                  {liveResults.categories.map((category) => (
                    <Link key={category.id} href={`/categorias/${category.slug}`}>
                      <Card variant="elevated" className="transition hover:-translate-y-0.5 hover:shadow-medium">
                        <CardBody className="p-4">
                          <Badge variant="warning">Categoría</Badge>
                          <h2 className="mt-2 text-lg font-semibold text-[var(--color-off-white)]">{category.name}</h2>
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : liveResults.brands.length || liveResults.categories.length ? (
            <div className="grid gap-3">
              {[...liveResults.brands.map((item) => ({ id: item.id, href: `/marcas/${item.slug}`, label: item.name, type: 'Marca' })), ...liveResults.categories.map((item) => ({ id: item.id, href: `/categorias/${item.slug}`, label: item.name, type: 'Categoría' }))].map((result) => (
                <Link key={result.id} href={result.href}>
                  <Card variant="elevated" className="transition hover:-translate-y-0.5 hover:shadow-medium">
                    <CardBody className="p-4">
                      <Badge variant="neutral">{result.type}</Badge>
                      <h2 className="mt-2 text-lg font-semibold text-[var(--color-off-white)]">{result.label}</h2>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin resultados"
              description="Prueba con otra palabra o solicita ayuda comercial."
              actionLabel="Ver productos"
              actionHref="/productos"
            />
          )}
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible buscar"
          description={error instanceof Error ? error.message : 'La búsqueda no respondió correctamente.'}
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
