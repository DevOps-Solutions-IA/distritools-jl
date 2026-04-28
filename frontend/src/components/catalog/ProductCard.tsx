import { AddToCartButton } from '@/components/cart/AddToCartButton';
import Link from 'next/link';
import { AvailabilityBadge } from '@/components/catalog/AvailabilityBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import type { CatalogProduct } from '@/features/catalog/types';

interface ProductCardProps {
  product: CatalogProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const displaySku =
    product.primarySku && !product.primarySku.toUpperCase().includes('DEMO')
      ? product.primarySku
      : null;

  return (
    <Card
      variant="elevated"
      className="flex h-full flex-col overflow-hidden border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(12,12,12,0.98))]"
    >
      <CardBody className="flex flex-1 flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {product.brand ? <Badge variant="neutral">{product.brand.name}</Badge> : null}
              {product.category ? <Badge variant="info">{product.category.name}</Badge> : null}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold leading-tight text-[var(--color-off-white)]">
                {product.name}
              </h3>
              <p className="line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                {product.description ??
                  'Referencia técnica para consulta comercial, comparación y compra guiada.'}
              </p>
            </div>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[rgba(245,183,0,0.06)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-industrial-yellow)]">
            {(product.brand?.name ?? 'JL')
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join('')}
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Referencia
            </p>
            <p className="text-sm font-medium text-[var(--color-off-white)]">
              {displaySku ?? 'Disponible para consulta comercial'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Precio base
            </p>
            <p className="text-lg font-semibold text-[var(--color-off-white)]">
              {product.primaryPriceLabel ?? 'A consultar'}
            </p>
          </div>
        </div>

        <AvailabilityBadge availability={product.availability} />

        <div className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Consulta rápida por detalle, carrito o asesoría comercial.
        </div>
      </CardBody>

      <CardFooter className="flex flex-col gap-3 border-t border-[var(--color-border)] p-6 sm:flex-row">
        <Link href={`/storefront/productos/${product.slug}`} className="w-full">
          <Button className="w-full">Ver detalle</Button>
        </Link>
        <AddToCartButton
          product={product}
          variants={
            product.primaryVariantId && product.primarySku && product.primaryPrice !== null
              ? [
                  {
                    id: product.primaryVariantId,
                    productId: product.id,
                    name: product.name,
                    sku: product.primarySku,
                    price: product.primaryPrice,
                    priceLabel: product.primaryPriceLabel ?? 'A consultar',
                    taxRate: '0.00',
                    warehouseId: null,
                  },
                ]
              : []
          }
          className="w-full"
        />
      </CardFooter>
    </Card>
  );
}
