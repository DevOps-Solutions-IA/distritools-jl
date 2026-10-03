import { AddToCartButton } from '@/components/cart/AddToCartButton';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { PriceDisplay } from '@/components/catalog/PriceDisplay';
import { ProductCommerceBadge } from '@/components/catalog/ProductCommerceBadge';
import { ProductImageFrame } from '@/components/catalog/ProductImageFrame';
import { getProductCommerceState } from '@/features/catalog/commerce';
import { isPubliclyPurchasable } from '@/features/catalog/live-search';
import type { CatalogProduct } from '@/features/catalog/types';

interface ProductCardProps {
  product: CatalogProduct;
}

function getCompactPresentation(presentation: string | null) {
  if (!presentation) {
    return null;
  }

  const normalized = presentation.toLocaleLowerCase('es-CO');
  if (
    normalized.includes('asesoría') ||
    normalized.includes('asesoria') ||
    normalized.includes('referencia') ||
    normalized.includes('configuración') ||
    normalized.includes('configuracion')
  ) {
    return null;
  }

  return presentation.length > 18 ? null : presentation;
}

export function ProductCard({ product }: ProductCardProps) {
  if (!isPubliclyPurchasable(product)) {
    return null;
  }

  const commerce = getProductCommerceState(product);
  const compactPresentation = getCompactPresentation(product.presentation);
  const productVariants =
    product.primaryVariantId && product.primarySku && product.primaryPrice !== null
      ? [
          {
            id: product.primaryVariantId,
            productId: product.id,
            name: product.name,
            sku: product.primarySku,
            price: product.primaryPrice!,
            priceLabel: product.primaryPriceLabel ?? `$ ${product.primaryPrice!.toLocaleString('es-CO')}`,
            taxRate: '0.00',
            warehouseId: null,
          },
        ]
      : [];
  const renderPrimaryAction = () => {
    if (commerce.canAddToCart) {
      return (
        <AddToCartButton
          product={product}
          variants={productVariants}
          className="h-11 w-full rounded-full px-3 text-sm"
          label={commerce.primaryAction}
          mode={commerce.cartMode === 'quote' ? 'quote' : 'buy'}
        />
      );
    }

    if (commerce.canRequestQuote) {
      return (
        <AddToCartButton
          product={product}
          variants={[]}
          className="h-11 w-full rounded-full px-3 text-sm"
          label={commerce.primaryAction}
          mode="quote"
        />
      );
    }

    return (
      <Button className="h-11 w-full rounded-full px-3 text-sm" disabled>
        {commerce.primaryAction}
      </Button>
    );
  };

  return (
    <Card
      variant="elevated"
      className="group relative flex h-full min-h-[10.25rem] flex-col overflow-hidden rounded-[1.15rem] border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(5,5,5,0.99))] transition duration-300 hover:border-[rgba(245,183,0,0.5)] md:min-h-0 md:rounded-[1.4rem] md:hover:-translate-y-1 md:hover:shadow-[0_26px_80px_rgba(0,0,0,0.42)]"
    >
      <Link
        href={`/productos/${product.slug}`}
        aria-label={`Ver producto ${product.name}`}
        className="absolute inset-0 z-0 md:hidden"
      />
      <CardBody className="relative z-10 grid flex-1 grid-cols-[6.75rem_1fr] gap-3 p-2.5 md:flex md:flex-col md:p-3">
        <div className="relative h-[8.75rem] md:h-auto md:min-h-0">
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5 md:left-3 md:top-3 md:gap-2">
            {product.brand ? (
              <span className="max-w-[4.9rem] truncate rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold text-[var(--color-off-white)] backdrop-blur md:max-w-none md:px-2.5 md:text-[11px]">
                {product.brand.name}
              </span>
            ) : null}
            <span className="hidden md:inline-flex">
              <ProductCommerceBadge commerce={commerce} />
            </span>
          </div>
          <ProductImageFrame product={product} compact className="!h-full !aspect-auto w-full md:!aspect-[1.22]" />
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-2 px-0.5 py-0.5 md:space-y-3 md:px-1 md:pb-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 md:hidden">
              {product.availability.status === 'low-stock' ? (
                <span className="truncate rounded-full bg-[rgba(245,183,0,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-industrial-yellow)]">
                  Bajo stock
                </span>
              ) : (
                <span className="truncate rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#22c55e]">
                  En stock
                </span>
              )}
              {compactPresentation ? (
                <span className="truncate rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                  {compactPresentation}
                </span>
              ) : null}
            </div>
            <Link href={`/productos/${product.slug}`}>
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-off-white)] md:min-h-[2.75rem] md:text-base md:leading-6">
                {product.name}
              </h3>
            </Link>
          </div>
          <div className="flex items-end justify-between gap-2 md:min-h-10 md:gap-3">
            <div className="min-w-0 space-y-1">
              <PriceDisplay
                priceLabel={product.primaryPriceLabel}
                className="text-lg leading-none md:text-xl md:leading-7"
              />
              <p className="text-[11px] font-medium text-[var(--color-text-secondary)] md:hidden">
                {product.availability.quantity
                  ? `${product.availability.quantity} disponibles`
                  : product.availability.label}
              </p>
            </div>
            {compactPresentation ? (
              <span className="hidden max-w-[8rem] truncate rounded-full border border-white/10 px-2.5 py-1 text-right text-[10px] font-semibold text-[var(--color-text-secondary)] md:inline-block">
                {compactPresentation}
              </span>
            ) : null}
          </div>
          <div className="relative z-20 md:hidden">
            {renderPrimaryAction()}
          </div>
        </div>
      </CardBody>

      <CardFooter className="hidden grid-cols-2 gap-2 border-t border-[var(--color-border)] p-3 md:grid">
        <Link href={`/productos/${product.slug}`} className="w-full">
          <Button className="h-10 w-full px-3 text-sm" variant="outline">
            Detalle
          </Button>
        </Link>
        {renderPrimaryAction()}
      </CardFooter>
    </Card>
  );
}
