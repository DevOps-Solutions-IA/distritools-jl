import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { filterCatalogProducts } from '@/features/catalog/filtering';
import { getCategoryListingData } from '@/features/catalog/queries';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categoryData = await getCategoryListingData(slug);

  if (!categoryData) {
    return {
      title: `Categoría no encontrada | ${siteConfig.name}`,
      description: 'La categoría solicitada no existe en el catálogo público.',
    };
  }

  return {
    title: `${categoryData.data.category.name} | ${siteConfig.name}`,
    description:
      categoryData.data.category.description ??
      `Compra productos de ${categoryData.data.category.name} en DistriTools JL.`,
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSingleValue(resolvedSearchParams.q);
  const brandSlug = getSingleValue(resolvedSearchParams.brand);
  const status = getSingleValue(resolvedSearchParams.status);
  const sort = getSingleValue(resolvedSearchParams.sort);

  async function loadPageData() {
    const categoryData = await getCategoryListingData(slug);

    if (!categoryData) return null;

    const { data } = categoryData;
    const filteredProducts = filterCatalogProducts(data.products, {
      query,
      brandSlug,
      status,
      sort,
    });

    return { data, filteredProducts };
  }

  let pageData: Awaited<ReturnType<typeof loadPageData>>;
  try {
    pageData = await loadPageData();
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar la categoría"
          description={error instanceof Error ? error.message : 'No pudimos cargar esta categoría.'}
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }

  if (!pageData) {
    return (
      <StorefrontShell>
        <EmptyState
          title="Categoría no encontrada"
          description="Explora las categorías activas para encontrar una alternativa."
          actionLabel="Ver categorías"
          actionHref="/categorias"
        />
      </StorefrontShell>
    );
  }

  const { data, filteredProducts } = pageData;

  return (
    <StorefrontShell>
      <section className="space-y-4 sm:space-y-6 lg:space-y-8">
        <Breadcrumbs
          className="hidden sm:block"
          items={[
            { label: 'Inicio', href: '/' },
            { label: 'Categorías', href: '/categorias' },
            { label: data.category.name },
          ]}
        />
        <CatalogHeader
          eyebrow="Categoría"
          title={data.category.name}
          description={
            data.category.description ??
            'Compra referencias disponibles con precio y stock publicado.'
          }
          stats={[`${filteredProducts.length} productos`, `${data.brands.length} marcas`]}
          primaryHref="/productos"
          primaryLabel="Ver productos"
        />
        <CatalogToolbar
          action={`/categorias/${data.category.slug}`}
          clearHref={`/categorias/${data.category.slug}`}
          brands={data.brands}
          categories={[]}
          products={data.products}
          resultCount={filteredProducts.length}
          query={query}
          selectedBrandSlug={brandSlug}
          selectedStatus={status}
          selectedSort={sort}
          hideCategoryFilter
          searchPlaceholder={`Buscar en ${data.category.name}`}
        />
        <ProductGrid
          products={filteredProducts}
          emptyTitle="No hay productos en esta categoría"
          emptyDescription="Ajusta los filtros o solicita asesoría para encontrar una alternativa."
        />
      </section>
    </StorefrontShell>
  );

}
