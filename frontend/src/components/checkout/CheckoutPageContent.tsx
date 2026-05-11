'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { useCart } from '@/features/cart/hooks';

export function CheckoutPageContent() {
  const { items, summary, clearCart } = useCart();
  const router = useRouter();

  return (
    <section className="space-y-4 pb-28 sm:space-y-8 sm:pb-0">
      <div className="rounded-[1.15rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#101010_0%,#0b0b0b_100%)] p-4 shadow-soft sm:rounded-[2rem] sm:p-8 sm:shadow-elevated">
        <div className="space-y-1.5 sm:space-y-4">
          <Badge variant="warning">Checkout invitado</Badge>
          <h1 className="text-2xl font-semibold text-[var(--color-off-white)] sm:text-4xl">
            Finalizar compra
          </h1>
          <p className="max-w-3xl text-sm leading-5 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
            Completa tus datos y confirma tu pedido.
          </p>
        </div>
      </div>

      {items.length ? (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
          <CheckoutForm
            onSuccess={({ kind, orderNumber, trackingCode, paymentMethod }) => {
              clearCart();
              const query =
                kind === 'order' && orderNumber
                  ? `?order=${encodeURIComponent(orderNumber)}&tracking=${encodeURIComponent(trackingCode ?? '')}&method=${encodeURIComponent(paymentMethod ?? 'commercial_confirmation')}`
                  : `?type=quote&method=${encodeURIComponent(paymentMethod ?? 'commercial_confirmation')}`;
              router.push(`/checkout/confirmacion${query}`);
            }}
          />
          <div className="space-y-3 sm:space-y-4">
            <CheckoutSummary items={items} subtotalLabel={summary.subtotalLabel} />
            <Link href="/carrito">
              <Button variant="outline" className="w-full">
                Volver al carrito
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <CartEmptyState />
      )}
    </section>
  );
}
