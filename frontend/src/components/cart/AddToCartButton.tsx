'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  mapCatalogProductToQuoteCartPayload,
  mapCatalogVariantToCartPayload,
} from '@/features/cart/mappers';
import { useCart } from '@/features/cart/hooks';
import { getProductCommerceState } from '@/features/catalog/commerce';
import type { CatalogProduct, CatalogVariant } from '@/features/catalog/types';

interface AddToCartButtonProps {
  product: CatalogProduct;
  variants: CatalogVariant[];
  className?: string;
  label?: string;
  mode?: 'buy' | 'quote';
}

export function AddToCartButton({
  product,
  variants,
  className,
  label,
  mode = 'buy',
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const commerce = getProductCommerceState(product);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? '');

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0] ?? null,
    [selectedVariantId, variants],
  );

  const isQuoteMode = mode === 'quote' || commerce.cartMode === 'quote';
  const isOutOfStock = product.availability.status === 'out-of-stock';
  const disabled = isQuoteMode ? false : !selectedVariant || isOutOfStock;
  const buttonLabel = label ?? 'Comprar';

  return (
    <div className="grid gap-3">
      {variants.length > 1 ? (
        <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
          Variante
          <select
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)]"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} · {variant.sku} · {variant.priceLabel}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <Button
        className={className}
        size="md"
        onClick={() => {
          if (isQuoteMode) {
            addItem(mapCatalogProductToQuoteCartPayload(product));
            return;
          }

          if (!selectedVariant) {
            return;
          }

          addItem(mapCatalogVariantToCartPayload(product, selectedVariant));
        }}
        disabled={disabled}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
