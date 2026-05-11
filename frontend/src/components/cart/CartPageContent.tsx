'use client';

import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { Badge } from '@/components/ui/Badge';
import { useCart } from '@/features/cart/hooks';

export function CartPageContent() {
  const { items, summary, removeItem, setQuantity } = useCart();

  return (
    <section className="space-y-5 sm:space-y-8">
      <div className="space-y-2 sm:space-y-4">
        <Badge variant="default">Carrito</Badge>
        <h1 className="text-2xl font-semibold text-[var(--color-off-white)] sm:text-4xl">
          Revisa tu selección
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
          Ajusta cantidades y continúa para confirmar compra o cotización.
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
