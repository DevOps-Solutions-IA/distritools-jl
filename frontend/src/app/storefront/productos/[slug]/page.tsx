import { AddToCartButton } from '@/components/cart/AddToCartButton';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AvailabilityBadge } from '@/components/catalog/AvailabilityBadge';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getProductDetailData } from '@/features/catalog/queries';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const result = await getProductDetailData(slug);
    if (!result.data) {
      return {
        title: `${siteConfig.name} | Producto no encontrado`,
        description: 'El producto solicitado no existe en el catálogo público actual.',
      };
    }

    return {
      title: `${result.data.name} | ${siteConfig.name}`,
      description:
        result.data.description ??
        `Ficha pública de ${result.data.name} en DistriTools JL.`,
    };
  } catch {
    return {
      title: `${siteConfig.name} | Detalle de producto`,
      description: 'Detalle público de producto del catálogo industrial.',
    };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const { data, gaps } = await getProductDetailData(slug);

    if (!data) {
      return (
        <StorefrontShell>
          <EmptyState
            title="Producto no encontrado"
            description="No existe un producto público con ese slug en el catálogo actual. Revisa la búsqueda o navega desde el listado principal."
            actionLabel="Volver al catálogo"
          />
        </StorefrontShell>
      );
    }

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
            {data.category ? (
              <>
                <li>/</li>
                <li>
                  <Link href={`/storefront/categorias/${data.category.slug}`}>{data.category.name}</Link>
                </li>
              </>
            ) : null}
            <li>/</li>
            <li className="font-semibold text-[var(--color-off-white)]">{data.name}</li>
          </ol>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Card variant="elevated" className="overflow-hidden">
            <CardBody className="flex min-h-[420px] flex-col justify-between bg-[linear-gradient(180deg,#1c1c1f_0%,#121212_100%)] p-8">
              <div className="space-y-3">
                <Badge variant="warning">Ficha principal</Badge>
                <h1 className="text-3xl font-semibold text-[var(--color-off-white)]">
                  {data.name}
                </h1>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                  {data.description ??
                    'Referencia industrial presentada con una lectura clara para revisión comercial y técnica.'}
                </p>
              </div>
              <div className="flex h-48 items-center justify-center rounded-[1.75rem] border border-[var(--color-border)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] text-center text-sm text-[var(--color-text-secondary)]">
                Visual de referencia
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  'Compra invitada',
                  'Soporte comercial',
                  'Lectura técnica clara',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-off-white)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {data.brand ? <Badge variant="neutral">{data.brand.name}</Badge> : null}
              {data.category ? <Badge variant="info">{data.category.name}</Badge> : null}
              {data.primarySku ? <Badge variant="default">{data.primarySku}</Badge> : null}
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-semibold leading-tight text-[var(--color-off-white)]">
                {data.name}
              </h2>
              <p className="text-base leading-7 text-[var(--color-text-secondary)]">
                {data.description ??
                  'Descripción comercial de apoyo para facilitar decisión, comparación y contacto.'}
              </p>
            </div>

            <div className="grid gap-4 rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                  Precio base
                </p>
                <p className="text-3xl font-semibold text-[var(--color-off-white)]">
                  {data.primaryPriceLabel ?? 'Precio a consultar'}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                  SKU principal
                </p>
                <p className="text-xl font-semibold text-[var(--color-off-white)]">
                  {data.primarySku ?? 'Disponible bajo validación comercial'}
                </p>
              </div>
            </div>

            <AvailabilityBadge availability={data.availability} />

            <div className="grid gap-3 sm:grid-cols-2">
              <AddToCartButton product={data} variants={data.variants} />
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                Consultar por WhatsApp
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Compra rápida',
                  text: 'Agrega la referencia al carrito y continúa sin crear cuenta.',
                },
                {
                  title: 'Validación real',
                  text: 'Stock, precio y condiciones se confirman antes de crear la orden.',
                },
                {
                  title: 'Asesoría directa',
                  text: 'Escala la conversación por WhatsApp cuando necesites soporte.',
                },
              ].map((item) => (
                <Card key={item.title} className="bg-[var(--color-surface-muted)]">
                  <CardBody className="space-y-2 p-5">
                    <h3 className="text-base font-semibold text-[var(--color-off-white)]">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                      {item.text}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card className="border-dashed bg-[var(--color-surface-muted)]">
              <CardBody className="space-y-3">
                <h3 className="text-lg font-semibold text-[var(--color-off-white)]">
                  Variantes disponibles
                </h3>
                <div className="grid gap-3">
                  {data.variants.length ? (
                    data.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[1fr_auto_auto]"
                      >
                        <div>
                          <p className="font-semibold text-[var(--color-off-white)]">
                            {variant.name}
                          </p>
                          <p className="text-sm text-[var(--color-steel-gray)]">{variant.sku}</p>
                        </div>
                        <p className="text-sm font-medium text-[var(--color-off-white)]">
                          {variant.priceLabel}
                        </p>
                        <Badge variant="neutral">IVA {variant.taxRate}</Badge>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="Sin variantes visibles"
                      description="Esta referencia aún no muestra variantes activas en la vitrina."
                    />
                  )}
                </div>
              </CardBody>
            </Card>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--color-off-white)]">
                  Complementa tu compra
                </h3>
                <Badge variant="warning">Próximamente</Badge>
              </div>
              <ProductGrid
                products={[]}
                emptyTitle="Pronto verás más recomendaciones aquí"
                emptyDescription="Seguimos ampliando la experiencia para mostrar productos complementarios."
              />
            </section>

            {gaps.length ? (
              <Card className="bg-[var(--color-surface-muted)]">
                <CardBody className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                    Ficha en evolución
                  </p>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Esta ficha seguirá sumando medios y atributos técnicos a medida que el portafolio crezca.
                  </p>
                </CardBody>
              </Card>
            ) : null}
          </div>
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar el detalle del producto"
          description={
            error instanceof Error
              ? error.message
              : 'La consulta pública del producto no respondió correctamente.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
