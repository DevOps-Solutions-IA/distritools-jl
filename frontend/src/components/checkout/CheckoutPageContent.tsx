'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { CheckoutSuccessState } from '@/components/checkout/CheckoutSuccessState';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { useCart } from '@/features/cart/hooks';

export function CheckoutPageContent() {
  const { items, summary, clearCart } = useCart();
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    message?: string;
  } | null>(null);

  if (completedOrder) {
    return (
      <section className="space-y-8">
        <div className="space-y-4">
          <Badge variant="success">Orden creada</Badge>
          <h1 className="text-4xl font-semibold text-[var(--color-off-white)]">
            Solicitud creada correctamente
          </h1>
          <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
            Tu orden ya fue registrada. Ahora puedes continuar con el siguiente paso del pago cuando aplique.
          </p>
        </div>
        <CheckoutSuccessState
          orderNumber={completedOrder.orderNumber}
          message={completedOrder.message}
        />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#101010_0%,#0b0b0b_100%)] p-8 shadow-elevated">
        <div className="space-y-4">
          <Badge variant="warning">Checkout invitado</Badge>
          <h1 className="text-4xl font-semibold text-[var(--color-off-white)]">
            Finaliza tu pedido en pocos pasos
          </h1>
          <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
            Completa datos de contacto y entrega para crear tu orden y continuar con el flujo de pago.
          </p>
        </div>
      </div>

      <CheckoutStepper />

      {items.length ? (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <CheckoutForm
            onSuccess={({ orderNumber, message }) => {
              clearCart();
              setCompletedOrder({ orderNumber, message });
            }}
          />
          <div className="space-y-4">
            <CheckoutSummary items={items} subtotalLabel={summary.subtotalLabel} />
            <Link href="/storefront/carrito">
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
