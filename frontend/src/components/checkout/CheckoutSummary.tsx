'use client';

import { Card, CardBody } from '@/components/ui/Card';
import { PriceDisplay } from '@/components/catalog/PriceDisplay';
import type { CartItem } from '@/features/cart/types';

interface CheckoutSummaryProps {
  items: CartItem[];
  subtotalLabel: string;
}

export function CheckoutSummary({ items, subtotalLabel }: CheckoutSummaryProps) {
  const quoteItems = items.filter((item) => item.variant.mode === 'quote');
  const pricedItems = items.filter((item) => item.variant.mode !== 'quote');

  return (
    <Card variant="elevated">
      <CardBody className="space-y-4 p-4 sm:space-y-5 sm:p-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            Resumen del pedido
          </p>
          <h2 className="text-xl font-semibold text-[var(--color-off-white)] sm:text-2xl">
            {subtotalLabel}
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-3 sm:p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-off-white)]">
                    {item.product.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {item.product.brandName ?? item.variant.name}
                  </p>
                </div>
                <div className="text-right">
                  <PriceDisplay
                    priceLabel={item.variant.mode === 'quote' ? null : item.variant.priceLabel}
                    mode="checkout"
                    className="text-sm"
                  />
                  <p className="text-xs text-[var(--color-text-secondary)]">x {item.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Subtotal</span>
            <span className="font-semibold text-[var(--color-off-white)]">
              {pricedItems.length ? subtotalLabel : 'Por cotizar'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Por cotizar</span>
            <span className="font-semibold text-[var(--color-off-white)]">
              {quoteItems.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Pago</span>
            <span className="font-semibold text-[var(--color-off-white)]">
              Pendiente de confirmación
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Confirmación</span>
            <span className="font-semibold text-[var(--color-off-white)]">Al validar el pedido</span>
          </div>
        </div>

        <div className="hidden gap-3 sm:grid sm:grid-cols-2">
          {[
            'Compra sin crear cuenta.',
            'Confirmaremos precio y disponibilidad.',
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs leading-5 text-[var(--color-text-secondary)] sm:p-4 sm:text-sm sm:leading-6">
          Verifica cantidades y datos de entrega antes de enviar el pedido.
        </div>
      </CardBody>
    </Card>
  );
}
