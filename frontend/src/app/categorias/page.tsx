import type { Metadata } from 'next';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { CategoryCard } from '@/components/catalog/CategoryCard';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { listCategories } from '@/lib/api/categories';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Categorías industriales | DistriTools JL',
  description:
    'Explora categorías de herramientas, compresores, fijación, soldadura, bombas y seguridad industrial.',
};

export default async function CategoriesPage() {
  async function loadPageData() {
    const categories = await listCategories();

    return { categories };
  }

  let pageData: Awaited<ReturnType<typeof loadPageData>>;
  try {
    pageData = await loadPageData();
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar categorías"
          description={error instanceof Error ? error.message : 'No pudimos cargar las categorías.'}
        />
      </StorefrontShell>
    );
  }

  const { categories } = pageData;

  return (
    <StorefrontShell>
      <section className="space-y-4 sm:space-y-8">
        <CatalogHeader
          eyebrow="Categorías"
          title="Líneas para obra, taller e industria"
          description="Navega por familias de producto y entra directo a referencias disponibles para compra."
          stats={[]}
        />
        <div className="flex flex-wrap gap-2">
          <StorefrontLinkButton href="/productos" storefrontVariant="primary">
            Ver productos
          </StorefrontLinkButton>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </StorefrontShell>
  );

}
