import { AddToCartButton } from '@/components/cart/AddToCartButton';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { PriceDisplay } from '@/components/catalog/PriceDisplay';
import { ProductCommerceBadge } from '@/components/catalog/ProductCommerceBadge';
import { ProductDetailAccordion } from '@/components/catalog/ProductDetailAccordion';
import { ProductImageFrame } from '@/components/catalog/ProductImageFrame';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getProductCommerceState } from '@/features/catalog/commerce';
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
        title: `Producto no encontrado | ${siteConfig.name}`,
        description: 'El producto solicitado no existe en el catálogo público.',
      };
    }

    return {
      title: result.data.seo.title ?? `${result.data.name} | ${siteConfig.name}`,
      description:
        result.data.seo.description ??
        result.data.description ??
        `Compra ${result.data.name} en DistriTools JL.`,
      openGraph: {
        title: result.data.seo.ogTitle ?? result.data.name,
        description:
          result.data.seo.ogDescription ??
          result.data.description ??
          `Producto ${result.data.name} en DistriTools JL.`,
        images: result.data.seo.ogImage ? [result.data.seo.ogImage] : undefined,
      },
    };
  } catch {
    return {
      title: `Detalle de producto | ${siteConfig.name}`,
      description: 'Detalle comercial de producto en DistriTools JL.',
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
    const { data } = await getProductDetailData(slug);

    if (!data) {
      return (
        <StorefrontShell>
          <EmptyState
            title="Producto no encontrado"
            description="Vuelve al catálogo para encontrar una alternativa."
            actionLabel="Ver productos"
            actionHref="/productos"
          />
        </StorefrontShell>
      );
    }

    const commerce = getProductCommerceState(data);
    const quoteMode = commerce.cartMode === 'quote';
    const productVariants =
      commerce.canAddToCart && commerce.cartMode === 'buy'
        ? data.variants
        : [];

    return (
      <StorefrontShell>
        <section className="space-y-4 sm:space-y-6 lg:space-y-8">
          <Breadcrumbs
            className="hidden sm:block"
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Productos', href: '/productos' },
              ...(data.category ? [{ label: data.category.name, href: `/categorias/${data.category.slug}` }] : []),
              { label: data.name },
            ]}
          />
          <div className="grid items-start gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
            <Card variant="elevated" className="overflow-hidden rounded-[1.35rem] lg:self-start lg:rounded-[2rem]">
              <CardBody className="space-y-3 p-3 sm:p-5">
                <ProductImageFrame product={data} className="h-[260px] sm:h-[360px] lg:h-[430px]" priority />
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {['Compra', 'Stock', 'Entrega'].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-[var(--color-border)] bg-white/[0.035] px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-off-white)] sm:px-4 sm:py-3 sm:text-xs"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-wrap gap-2">
                {data.brand ? <Badge variant="neutral">{data.brand.name}</Badge> : null}
                {data.category ? <Badge variant="info">{data.category.name}</Badge> : null}
                <ProductCommerceBadge commerce={commerce} />
              </div>

              <div className="space-y-2 sm:space-y-4">
                <h1 className="text-2xl font-semibold leading-tight text-[var(--color-off-white)] sm:text-4xl lg:text-5xl">
                  {data.name}
                </h1>
                <p className="line-clamp-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
                  {data.description ?? 'Producto disponible para compra con asesoría comercial.'}
                </p>
              </div>

              <div className="grid gap-3 rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-soft sm:rounded-[1.75rem] sm:p-5 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--color-steel-gray)]">Precio</p>
                  <PriceDisplay
                    priceLabel={commerce.showPrice ? data.primaryPriceLabel : null}
                    mode="pdp"
                    className="text-2xl sm:text-3xl"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--color-steel-gray)]">Presentación</p>
                  <p className="text-base font-semibold text-[var(--color-off-white)] sm:text-xl">
                    {data.presentation ?? data.primarySku ?? 'Presentación pendiente'}
                  </p>
                </div>
              </div>

              <div className="sticky bottom-3 z-20 grid gap-2 rounded-[1.2rem] border border-white/10 bg-[rgba(5,5,5,0.92)] p-2 shadow-elevated backdrop-blur sm:static sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
                  <AddToCartButton
                    product={data}
                    variants={productVariants}
                    label="Comprar"
                    mode={quoteMode ? 'quote' : 'buy'}
                  />
                <a
                  href={siteConfig.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.055] px-5 text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)] hover:bg-white/10"
                >
                  WhatsApp
                </a>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Compra clara', 'Revisa precio, cantidad y presentación.'],
                  ['Disponibilidad', 'Compras con precio y stock publicado.'],
                  ['Soporte', 'Te ayudamos a elegir la solución correcta.'],
                ].map(([title, text]) => (
                    <Card key={title} className="bg-[var(--color-surface-muted)]">
                    <CardBody className="space-y-1 p-3 sm:space-y-2 sm:p-5">
                      <h2 className="text-base font-semibold text-[var(--color-off-white)]">{title}</h2>
                      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{text}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>

              <Card className="bg-[var(--color-surface-muted)]">
                <CardBody className="space-y-3 p-3 sm:space-y-4 sm:p-4">
                  <ProductDetailAccordion title="Detalles" defaultOpen>
                    <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                      {data.longDescription ?? data.description ?? 'Detalles disponibles con asesoría comercial.'}
                    </p>
                  </ProductDetailAccordion>
                  {data.attributes.length ? (
                    <ProductDetailAccordion title="Especificaciones">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {data.attributes.map((attribute) => (
                          <div
                            key={`${attribute.label}-${attribute.value}`}
                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4"
                          >
                            <p className="text-xs font-semibold text-[var(--color-steel-gray)]">{attribute.label}</p>
                            <p className="text-sm font-semibold text-[var(--color-off-white)]">{attribute.value}</p>
                          </div>
                        ))}
                      </div>
                    </ProductDetailAccordion>
                  ) : null}
                </CardBody>
              </Card>
            </div>
          </div>
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar el producto"
          description={error instanceof Error ? error.message : 'No pudimos cargar este producto.'}
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
