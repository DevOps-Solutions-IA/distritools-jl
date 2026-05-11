'use client';

import { useMemo } from 'react';
import { useCartContext } from '@/features/cart/context';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function useCart() {
  const context = useCartContext();
  const summary = useMemo(() => {
    const pricedItems = context.state.items.filter((item) => item.variant.mode !== 'quote');
    const quoteItems = context.state.items.filter((item) => item.variant.mode === 'quote');
    const subtotal = pricedItems.reduce(
      (accumulator, item) => accumulator + item.variant.price * item.quantity,
      0,
    );

    return {
      itemCount: context.state.items.reduce(
        (accumulator, item) => accumulator + item.quantity,
        0,
      ),
      subtotal,
      subtotalLabel: currencyFormatter.format(subtotal),
      pricedItemCount: pricedItems.reduce((accumulator, item) => accumulator + item.quantity, 0),
      quoteItemCount: quoteItems.reduce((accumulator, item) => accumulator + item.quantity, 0),
      hasQuoteItems: quoteItems.length > 0,
      hasPricedItems: pricedItems.length > 0,
    };
  }, [context.state.items]);

  return {
    ...context,
    items: context.state.items,
    summary,
  };
}
