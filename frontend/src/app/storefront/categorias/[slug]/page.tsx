import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandStrip } from '@/components/catalog/BrandStrip';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getCategoryListingData } from '@/features/catalog/queries';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categoryData = await getCategoryListingData(slug);

  if (!categoryData) {
    return {
      title: `${siteConfig.name} | Categoría no encontrada`,
      description: 'La categoría pública solicitada no existe en el catálogo actual.',
    };
  }

  return {
    title: `${categoryData.data.category.name} | ${siteConfig.name}`,
    description:
      categoryData.data.category.description ??
      `Categoría pública ${categoryData.data.category.name} del catálogo industrial de DistriTools JL.`,
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const categoryData = await getCategoryListingData(slug);

    if (!categoryData) {
      return (
        <StorefrontShell>
          <EmptyState
            title="Categoría no encontrada"
            description="La categoría solicitada no existe o aún no está publicada en el catálogo público."
            actionLabel="Volver al storefront"
          />
        </StorefrontShell>
      );
    }

    const { data } = categoryData;

    return (
      <StorefrontShell>
        <nav className="mb-6 text-sm text-[var(--color-steel-gray)]">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/storefront">Inicio</Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/storefront/productos">Productos</Link>
            </li>
            <li>/</li>
            <li className="font-semibold text-[var(--color-off-white)]">{data.category.name}</li>
          </ol>
        </nav>

        <section className="space-y-8">
          <div className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-soft">
            <div className="space-y-4">
              <Badge variant="info">Categoría</Badge>
              <h1 className="text-4xl font-semibold text-[var(--color-off-white)]">
                {data.category.name}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
                {data.category.description ?? 'Explora esta línea y revisa las referencias disponibles para tu operación.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-[var(--color-off-white)]">
                  Marcas presentes en esta línea
                </h2>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Accede a las marcas relacionadas con esta familia.
                </p>
              </div>
            </div>
            <BrandStrip brands={data.brands} />
          </div>

          <ProductGrid
            products={data.products}
            emptyTitle="No hay productos visibles en esta categoría"
            emptyDescription="Pronto verás aquí las referencias activas de esta línea."
          />
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar la categoría"
          description={
            error instanceof Error
              ? error.message
              : 'La consulta pública de categoría no respondió correctamente.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
