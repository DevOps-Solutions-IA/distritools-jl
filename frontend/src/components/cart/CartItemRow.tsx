'use client';

import { Button } from '@/components/ui/Button';
import type { CartItem } from '@/features/cart/types';

interface CartItemRowProps {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}

export function CartItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: CartItemRowProps) {
  return (
    <div className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--color-graphite-black)]">
            {item.product.name}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{item.variant.name}</p>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            {item.variant.sku}
          </p>
        </div>
        <p className="text-right text-sm font-semibold text-[var(--color-graphite-black)]">
          {item.variant.priceLabel}
        </p>
      </div>

      <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
        {item.availabilityDescription}
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDecrease} aria-label="Disminuir cantidad">
            -
          </Button>
          <span className="min-w-8 text-center text-sm font-semibold text-[var(--color-graphite-black)]">
            {item.quantity}
          </span>
          <Button variant="outline" size="sm" onClick={onIncrease} aria-label="Aumentar cantidad">
            +
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}
