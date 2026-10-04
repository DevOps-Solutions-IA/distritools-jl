import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { filterCatalogProducts } from '@/features/catalog/filtering';
import { getBrandDetailData } from '@/features/catalog/queries';

export const dynamic = 'force-dynamic';

type SearchParamsValue = string | string[] | undefined;

interface BrandPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const response = await getBrandDetailData(slug);

  if (!response) {
    return {
      title: 'Marca no encontrada | DistriTools JL',
      description: 'La marca solicitada no existe en el catálogo público.',
    };
  }

  return {
    title: `${response.data.brand.name} | DistriTools JL`,
    description:
      response.data.brand.metadata?.shortDescription ??
      response.data.brand.description ??
      `Productos y líneas ${response.data.brand.name} en DistriTools JL.`,
  };
}

export default async function BrandDetailPage({ params, searchParams }: BrandPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSingleValue(resolvedSearchParams.q);
  const categorySlug = getSingleValue(resolvedSearchParams.category);
  const status = getSingleValue(resolvedSearchParams.status);
  const sort = getSingleValue(resolvedSearchParams.sort);

  async function loadPageData() {
    const response = await getBrandDetailData(slug);

    if (!response) return null;

    const { brand, products, relatedCategories } = response.data;
    const filteredProducts = filterCatalogProducts(products, {
      query,
      categorySlug,
      status,
      sort,
    });
    const description =
      brand.metadata?.shortDescription ??
      brand.description ??
      'Marca disponible para compra directa con productos publicados.';

    return { brand, products, relatedCategories, filteredProducts, description };
  }

  let pageData: Awaited<ReturnType<typeof loadPageData>>;
  try {
    pageData = await loadPageData();
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar la marca"
          description={error instanceof Error ? error.message : 'No pudimos cargar esta marca.'}
        />
      </StorefrontShell>
    );
  }

  if (!pageData) {
    return (
      <StorefrontShell>
        <EmptyState
          title="Marca no encontrada"
          description="Vuelve al directorio para explorar fabricantes disponibles."
          actionLabel="Ver marcas"
          actionHref="/marcas"
        />
      </StorefrontShell>
    );
  }

  const { brand, products, relatedCategories, filteredProducts, description } = pageData;

  return (
    <StorefrontShell>
      <section className="space-y-4 sm:space-y-6 lg:space-y-8">
        <Breadcrumbs
          className="hidden sm:block"
          items={[
            { label: 'Inicio', href: '/' },
            { label: 'Marcas', href: '/marcas' },
            { label: brand.name },
          ]}
        />
        <CatalogHeader
          eyebrow="Marca"
          title={brand.name}
          description={description}
          stats={[
            `${filteredProducts.length} productos`,
            `${relatedCategories.length} categorías`,
          ]}
          primaryHref={`/productos?brand=${brand.slug}`}
          primaryLabel="Ver productos"
          secondaryHref="/buscar"
          secondaryLabel="Consultar"
        />
        <CatalogToolbar
          action={`/marcas/${brand.slug}`}
          clearHref={`/marcas/${brand.slug}`}
          brands={[]}
          categories={relatedCategories}
          products={products}
          resultCount={filteredProducts.length}
          query={query}
          selectedCategorySlug={categorySlug}
          selectedStatus={status}
          selectedSort={sort}
          hideBrandFilter
          searchPlaceholder={`Buscar en ${brand.name}`}
        />
        <ProductGrid
          products={filteredProducts}
          emptyTitle={`No hay productos publicados para ${brand.name}.`}
          emptyDescription="Ajusta los filtros o solicita asesoría para encontrar una alternativa."
        />
      </section>
    </StorefrontShell>
  );

}
