'use client';

import { Card, CardBody } from '@/components/ui/Card';
import type { CartItem } from '@/features/cart/types';

interface CheckoutSummaryProps {
  items: CartItem[];
  subtotalLabel: string;
}

export function CheckoutSummary({ items, subtotalLabel }: CheckoutSummaryProps) {
  return (
    <Card variant="elevated">
      <CardBody className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            Resumen del pedido
          </p>
          <h2 className="text-2xl font-semibold text-[var(--color-off-white)]">
            {subtotalLabel}
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-off-white)]">
                    {item.product.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {item.variant.name} · {item.variant.sku}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--color-off-white)]">
                    {item.variant.priceLabel}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">x {item.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Subtotal visible</span>
            <span className="font-semibold text-[var(--color-off-white)]">{subtotalLabel}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Pago</span>
            <span className="font-semibold text-[var(--color-off-white)]">Pendiente</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Confirmación final</span>
            <span className="font-semibold text-[var(--color-off-white)]">Posterior al pago</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            'Checkout invitado sin registro.',
            'La confirmación del pago ocurre después del proceso de pasarela.',
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
          Verifica tus cantidades y datos antes de crear la orden. La confirmación del pago se realiza posteriormente en el flujo de la pasarela.
        </div>
      </CardBody>
    </Card>
  );
}
