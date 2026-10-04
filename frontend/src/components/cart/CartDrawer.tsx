'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { useCart } from '@/features/cart/hooks';
import { trackCommerceEvent } from '@/lib/observability/commerce-events';

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function CartDrawer() {
  const isMounted = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const {
    items,
    summary,
    state,
    toggleDrawer,
    closeDrawer,
    removeItem,
    setQuantity,
  } = useCart();
  const primaryActionLabel = 'Finalizar compra';
  const totalLabel = summary.hasPricedItems
    ? summary.hasQuoteItems
      ? 'Subtotal parcial'
      : 'Subtotal'
    : 'Total por confirmar';

  useEffect(() => {
    if (!state.isDrawerOpen) {
      return;
    }

    trackCommerceEvent('mini_cart_opened', {
      itemCount: summary.itemCount,
      hasQuoteItems: summary.hasQuoteItems,
      hasPricedItems: summary.hasPricedItems,
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    closeDrawer,
    state.isDrawerOpen,
    summary.hasPricedItems,
    summary.hasQuoteItems,
    summary.itemCount,
  ]);

  const drawerOverlay = state.isDrawerOpen ? (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
      onClick={closeDrawer}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-cart-title"
        className="absolute inset-x-2 bottom-2 top-[max(0.75rem,env(safe-area-inset-top))] flex w-auto flex-col gap-3 overflow-hidden rounded-[1.6rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111_0%,#070707_100%)] p-3 shadow-[0_-28px_90px_rgba(0,0,0,0.62)] sm:inset-x-6 sm:bottom-6 sm:top-auto sm:h-[88vh] sm:max-h-[42rem] sm:p-6 lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:max-h-none lg:w-full lg:max-w-[34rem] lg:rounded-none lg:rounded-l-[2rem] lg:border-y-0 lg:border-r-0 lg:p-6 lg:shadow-elevated"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 sm:pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Carrito
            </p>
            <h2 id="mini-cart-title" className="mt-1 text-xl font-semibold text-[var(--color-off-white)] sm:text-2xl">
              Tu selección
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] sm:mt-1 sm:text-sm">
              {summary.itemCount} {summary.itemCount === 1 ? 'producto' : 'productos'}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={closeDrawer}
            aria-label="Cerrar mini carrito"
            className="h-10 w-10 rounded-full p-0 text-xl"
          >
            ×
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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

        <div className="space-y-2 rounded-[1.15rem] border border-[rgba(245,183,0,0.22)] bg-[radial-gradient(circle_at_top_right,rgba(245,183,0,0.12),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.08))] p-3 sm:space-y-4 sm:rounded-[1.35rem] sm:p-5">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--color-text-secondary)]">{totalLabel}</span>
              <strong className="text-lg text-[var(--color-off-white)]">
                {summary.hasPricedItems ? summary.subtotalLabel : 'Por confirmar'}
              </strong>
            </div>
            {summary.hasQuoteItems ? (
              <div className="flex items-center justify-between gap-4 text-sm text-[var(--color-text-secondary)]">
                <span>Productos por cotizar</span>
                <strong className="text-[var(--color-off-white)]">{summary.quoteItemCount}</strong>
              </div>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-[var(--color-text-secondary)] sm:text-sm sm:leading-6">
            {summary.hasQuoteItems
              ? 'Confirmaremos disponibilidad antes de finalizar.'
              : 'Revisa tu selección y continúa al checkout.'}
          </p>
          <div className="grid gap-3">
            {items.length ? (
              <Link
                href="/checkout"
                onClick={() => {
                  trackCommerceEvent('mini_cart_checkout_clicked', {
                    itemCount: summary.itemCount,
                    hasQuoteItems: summary.hasQuoteItems,
                    hasPricedItems: summary.hasPricedItems,
                  });
                  closeDrawer();
                }}
              >
                <Button className="w-full">{primaryActionLabel}</Button>
              </Link>
            ) : (
              <Button className="w-full" disabled>
                Continuar
              </Button>
            )}
            <Link href="/carrito" onClick={closeDrawer}>
              <Button variant="outline" className="w-full">
                Ver carrito
              </Button>
            </Link>
            <Link href="/productos" onClick={closeDrawer}>
              <Button variant="ghost" className="w-full">
                Seguir comprando
              </Button>
            </Link>
          </div>
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <Button
        variant="secondary"
        onClick={toggleDrawer}
        aria-label={`Abrir carrito, ${summary.itemCount} productos`}
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
      {isMounted ? createPortal(drawerOverlay, document.body) : null}
    </>
  );
}
