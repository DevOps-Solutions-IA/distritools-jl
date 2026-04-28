'use client';

import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { Badge } from '@/components/ui/Badge';
import { useCart } from '@/features/cart/hooks';

export function CartPageContent() {
  const { items, summary, removeItem, setQuantity } = useCart();

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <Badge variant="default">Selección de compra</Badge>
        <h1 className="text-4xl font-semibold text-[var(--color-off-white)]">
          Revisa tu selección antes de pasar al checkout
        </h1>
        <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
          Ajusta cantidades, valida tu selección y continúa al siguiente paso de compra.
        </p>
      </div>

      {items.length ? (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onIncrease={() => setQuantity(item.variant.id, item.quantity + 1)}
                onDecrease={() => {
                  if (item.quantity <= 1) {
                    removeItem(item.variant.id);
                    return;
                  }

                  setQuantity(item.variant.id, item.quantity - 1);
                }}
                onRemove={() => removeItem(item.variant.id)}
              />
            ))}
          </div>
          <CartSummary
            summary={summary}
            checkoutDisabled={!items.length}
          />
        </div>
      ) : (
        <CartEmptyState />
      )}
    </section>
  );
}
