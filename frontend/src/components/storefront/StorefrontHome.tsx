import { BrandStrip } from '@/components/catalog/BrandStrip';
import { CategoryCard } from '@/components/catalog/CategoryCard';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontHero } from '@/components/storefront/StorefrontHero';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { getStorefrontHomeData } from '@/features/catalog/queries';

export async function StorefrontHome() {
  async function loadPageData() {
    const { data } = await getStorefrontHomeData();
    const keyLines = [
      {
        title: 'Compresores y aire',
        text: 'Equipos y accesorios para trabajo continuo.',
        href: '/productos?category=compresores',
      },
      {
        title: 'Fijación industrial',
        text: 'Soluciones para montaje, anclaje y obra.',
        href: '/productos?category=fijacion',
      },
      {
        title: 'Soldadura y corte',
        text: 'Herramientas para unión, corte y operación técnica.',
        href: '/productos?category=soldadura',
      },
    ];

    return { data, keyLines };
  }

  let pageData: Awaited<ReturnType<typeof loadPageData>>;
  try {
    pageData = await loadPageData();
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No pudimos cargar la tienda"
          description={
            error instanceof Error
              ? error.message
              : 'Intenta nuevamente o contáctanos para ayudarte con tu compra.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }

  const { data, keyLines } = pageData;

  return (
    <StorefrontShell>
      <StorefrontHero
        featuredFamilies={[
          'Compresores',
          'Herramientas neumáticas',
          'Fijación',
          'Soldadura',
          'Bombas',
          'Seguridad industrial',
        ]}
      />

      <section className="mt-6 space-y-4 sm:mt-8">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="warning">Productos</Badge>
            <h2 className="text-xl font-semibold text-[var(--color-off-white)] md:text-3xl">
              Destacados
            </h2>
          </div>
          <StorefrontLinkButton href="/productos" storefrontVariant="ghost" storefrontSize="compact">Ver todos</StorefrontLinkButton>
        </div>
        <ProductGrid products={data.featuredProducts.slice(0, 8)} />
      </section>

      <section className="mt-7 space-y-3 sm:mt-10 sm:space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="warning">Líneas clave</Badge>
            <h2 className="text-xl font-semibold text-[var(--color-off-white)] md:text-3xl">
              Compra por operación
            </h2>
          </div>
        </div>
        <div className="grid gap-2.5 md:grid-cols-3">
          {keyLines.map((line) => (
            <a
              key={line.title}
              href={line.href}
              className="group rounded-[1.2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(245,183,0,0.1),rgba(255,255,255,0.025))] p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-industrial-yellow)]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[rgba(245,183,0,0.14)] text-xs font-black text-[var(--color-industrial-yellow)]">
                JL
              </span>
              <h3 className="mt-3 text-base font-semibold text-[var(--color-off-white)]">
                {line.title}
              </h3>
              <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                {line.text}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-7 space-y-3 sm:mt-10 sm:space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="info">Marcas</Badge>
            <h2 className="text-xl font-semibold text-[var(--color-off-white)] md:text-3xl">
              Compra por marca
            </h2>
          </div>
          <StorefrontLinkButton href="/marcas" storefrontVariant="ghost" storefrontSize="compact">Ver marcas</StorefrontLinkButton>
        </div>
        <BrandStrip brands={data.brands} />
      </section>

      <section className="mt-7 space-y-3 sm:mt-10 sm:space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="default">Categorías</Badge>
            <h2 className="text-xl font-semibold text-[var(--color-off-white)] md:text-3xl">
              Categorías clave
            </h2>
          </div>
          <StorefrontLinkButton href="/productos" storefrontVariant="ghost" storefrontSize="compact">Ver productos</StorefrontLinkButton>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
          {data.categories.slice(0, 6).map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </StorefrontShell>
  );

}
