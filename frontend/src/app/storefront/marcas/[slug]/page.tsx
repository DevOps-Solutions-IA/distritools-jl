import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandFamilyList } from '@/components/catalog/BrandFamilyList';
import { CategoryRail } from '@/components/catalog/CategoryRail';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getBrandDetailData } from '@/features/catalog/queries';

export const dynamic = 'force-dynamic';

interface BrandPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `DistriTools JL | Marca ${slug}`,
    description: `Familias, categorías y productos visibles para la marca ${slug} dentro del catálogo DistriTools JL.`,
  };
}

export default async function BrandDetailPage({ params }: BrandPageProps) {
  const { slug } = await params;

  try {
    const response = await getBrandDetailData(slug);

    if (!response) {
      return (
        <StorefrontShell>
          <EmptyState
            title="Marca no encontrada"
            description="La marca solicitada no existe en la taxonomía activa del catálogo."
            actionLabel="Ver todas las marcas"
            actionHref="/storefront/marcas"
          />
        </StorefrontShell>
      );
    }

    const { brand, products, relatedCategories } = response.data;

    return (
      <StorefrontShell>
        <section className="grid gap-8 rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#151515_0%,#0c0c0c_100%)] p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Marca activa</Badge>
              <Badge variant="neutral">Taxonomía comercial</Badge>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-5xl">
                {brand.name}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
                {brand.metadata?.longDescription ?? brand.description ?? 'Marca activa dentro del portafolio industrial de DistriTools JL.'}
              </p>
            </div>
            <BrandFamilyList families={brand.metadata?.productFamilies ?? []} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={`/storefront/productos?brand=${brand.slug}`}>
                <Button size="lg">Ver catálogo filtrado</Button>
              </Link>
              <Link href="/storefront/marcas">
                <Button size="lg" variant="outline">
                  Volver a marcas
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {(brand.metadata?.industrialFocus ?? []).slice(0, 4).map((focus) => (
              <div
                key={focus}
                className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-sm text-[var(--color-off-white)]"
              >
                {focus}
              </div>
            ))}
          </div>
        </section>

        {relatedCategories.length ? (
          <section className="mt-10 space-y-5">
            <div className="space-y-2">
              <Badge variant="info">Categorías habilitadas</Badge>
              <h2 className="text-3xl font-semibold text-[var(--color-off-white)]">
                Familias internas relacionadas con {brand.name}
              </h2>
            </div>
            <CategoryRail categories={relatedCategories} />
          </section>
        ) : null}

        <section className="mt-12 space-y-5">
          <div className="space-y-2">
            <Badge variant="default">Productos visibles</Badge>
            <h2 className="text-3xl font-semibold text-[var(--color-off-white)]">
              Referencias visibles para esta marca
            </h2>
          </div>
          <ProductGrid
            products={products}
            emptyTitle={`Aún no hay referencias visibles para ${brand.name}.`}
            emptyDescription="La línea de marca ya está preparada para recibir referencias aprobadas comercialmente."
          />
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar la marca"
          description={error instanceof Error ? error.message : 'El backend no respondió como se esperaba.'}
        />
      </StorefrontShell>
    );
  }
}
