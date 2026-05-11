'use client';

import { Button } from '@/components/ui/Button';
import { PriceDisplay } from '@/components/catalog/PriceDisplay';
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
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 rounded-[1.2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:grid-cols-[92px_1fr] sm:gap-4 sm:rounded-[1.35rem] sm:p-4">
      <div className="grid h-24 place-items-center rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(245,183,0,0.16),rgba(255,255,255,0.035)_48%,rgba(0,0,0,0.30))]">
        <svg aria-hidden="true" viewBox="0 0 44 44" className="h-9 w-9 text-[var(--color-industrial-yellow)]" fill="none">
          <path d="M10 25h9l11-11 4 4-11 11v4H10v-8Zm4 4h7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 space-y-3 sm:space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {item.product.brandName ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                {item.product.brandName}
              </p>
            ) : null}
            <h3 className="line-clamp-2 text-base font-semibold text-[var(--color-off-white)]">
              {item.product.name}
            </h3>
            <p className="line-clamp-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">{item.variant.name}</p>
          </div>
          <PriceDisplay
            priceLabel={item.variant.mode === 'quote' ? null : item.variant.priceLabel}
            mode="cart"
            className="text-right text-base"
          />
        </div>

        <div className="hidden flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)] sm:flex">
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {item.variant.mode === 'quote' ? 'Cotización' : item.variant.sku}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {item.availabilityLabel}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDecrease} aria-label="Disminuir cantidad">
              -
            </Button>
            <span className="min-w-8 text-center text-sm font-semibold text-[var(--color-off-white)]">
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
    </div>
  );
}
