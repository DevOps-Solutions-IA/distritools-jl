'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { useCart } from '@/features/cart/hooks';

export function CartDrawer() {
  const {
    items,
    summary,
    state,
    toggleDrawer,
    closeDrawer,
    removeItem,
    setQuantity,
  } = useCart();

  return (
    <>
      <Button
        variant="secondary"
        onClick={toggleDrawer}
        aria-label={`Abrir carrito, ${summary.itemCount} items`}
        className="relative h-11 w-11 rounded-full p-0"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="20" r="1.25" />
          <circle cx="18" cy="20" r="1.25" />
          <path d="M3 4h2.4a1 1 0 0 1 .97.757L7 8h12.4a1 1 0 0 1 .978 1.208l-1.1 4.8A2 2 0 0 1 17.328 15H8.35a2 2 0 0 1-1.94-1.516L4.3 5.3A1 1 0 0 0 3.33 4.5H3" />
        </svg>
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-industrial-yellow)] px-1 text-[10px] font-bold text-[#111111]">
          {summary.itemCount}
        </span>
      </Button>

      {state.isDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(17,24,39,0.45)] backdrop-blur-sm" onClick={closeDrawer}>
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col gap-5 border-l border-[var(--color-border)] bg-[var(--color-background)] p-6 shadow-elevated"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  Selección actual
                </p>
                <h2 className="text-2xl font-semibold text-[var(--color-off-white)]">
                  {summary.itemCount} item(s)
                </h2>
              </div>
              <Button variant="ghost" onClick={closeDrawer}>
                Cerrar
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
              {items.length ? (
                items.map((item) => (
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
                ))
              ) : (
                <CartEmptyState />
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Subtotal</span>
                <strong className="text-lg text-[var(--color-off-white)]">
                  {summary.subtotalLabel}
                </strong>
              </div>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Revisa tu selección, ajusta cantidades y continúa a la solicitud de compra.
              </p>
              <div className="grid gap-3">
                <Link href="/storefront/carrito" onClick={closeDrawer}>
                  <Button variant="outline" className="w-full">
                    Ver carrito
                  </Button>
                </Link>
                {items.length ? (
                  <Link href="/storefront/checkout" onClick={closeDrawer}>
                    <Button className="w-full">Ir a checkout</Button>
                  </Link>
                ) : (
                  <Button className="w-full" disabled>
                    Ir a checkout
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
