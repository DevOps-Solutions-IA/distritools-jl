import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandStrip } from '@/components/catalog/BrandStrip';
import { CategoryCard } from '@/components/catalog/CategoryCard';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontHero } from '@/components/storefront/StorefrontHero';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { siteConfig } from '@/config/site';
import { getStorefrontHomeData } from '@/features/catalog/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${siteConfig.name} | Catálogo industrial`,
  description:
    'Explora categorías, marcas y soluciones industriales de DistriTools JL.',
};

export default async function StorefrontPage() {
  try {
    const { data } = await getStorefrontHomeData();
    const leadingBrands = data.brands.slice(0, 3);

    return (
      <StorefrontShell>
        <StorefrontHero
          metrics={[
            {
              label: 'Marcas activas',
              value: `${data.brands.length}`,
              detail: 'Líneas priorizadas para la vitrina principal.',
            },
            {
              label: 'Líneas clave',
              value: `${data.categories.length}`,
              detail: 'Familias organizadas para navegar rápido.',
            },
            {
              label: 'Atención',
              value: 'Directa',
              detail: 'Soporte comercial para consulta y compra.',
            },
          ]}
          featuredFamilies={[
            'Compresores',
            'Herramientas neumáticas',
            'Fijación',
            'Soldadura',
            'Bombas',
            'Seguridad industrial',
          ]}
          leadingBrands={leadingBrands.map((brand) => ({
            name: brand.name,
            slug: brand.slug,
            summary: brand.metadata?.shortDescription ?? brand.description ?? 'Línea técnica activa en el catálogo.',
          }))}
        />

        <section className="mt-10 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="info">Marcas estratégicas</Badge>
              <h2 className="text-3xl font-semibold text-[var(--color-off-white)]">
                Marcas clave para operación, obra e industria
              </h2>
            </div>
            <Link href="/storefront/marcas">
              <Button variant="ghost">Ver marcas</Button>
            </Link>
          </div>
          <BrandStrip brands={data.brands} />
        </section>

        <section className="mt-12 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="default">Líneas principales</Badge>
              <h2 className="text-3xl font-semibold text-[var(--color-off-white)]">
                Familias principales
              </h2>
            </div>
            <Link href="/storefront/productos">
              <Button variant="ghost">Ver catálogo</Button>
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {data.categories.slice(0, 3).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-5">
          <div className="space-y-2">
            <Badge variant="warning">Selección visible</Badge>
            <h2 className="text-3xl font-semibold text-[var(--color-off-white)]">
              Referencias visibles del catálogo
            </h2>
          </div>
          <ProductGrid products={data.featuredProducts.slice(0, 3)} />
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar el storefront conectado"
          description={
            error instanceof Error
              ? error.message
              : 'El backend no respondió como se esperaba. Revisa disponibilidad del API o variables públicas.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
