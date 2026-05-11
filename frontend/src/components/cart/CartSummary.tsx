'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import type { CartSummary as CartSummaryType } from '@/features/cart/types';

interface CartSummaryProps {
  summary: CartSummaryType;
  checkoutDisabled?: boolean;
}

export function CartSummary({
  summary,
  checkoutDisabled = false,
}: CartSummaryProps) {
  return (
    <Card variant="elevated" className="sticky bottom-3 top-auto z-20 lg:top-6">
      <CardBody className="space-y-4 p-4 sm:space-y-5 sm:p-5">
        <div className="space-y-1 sm:space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            Resumen
          </p>
          <h2 className="text-xl font-semibold text-[var(--color-off-white)] sm:text-2xl">
            {summary.hasPricedItems ? summary.subtotalLabel : 'Por cotizar'}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {summary.itemCount} unidades seleccionadas.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs leading-5 text-[var(--color-text-secondary)] sm:p-4 sm:text-sm sm:leading-6">
          {summary.hasQuoteItems
            ? 'Confirmaremos precio y disponibilidad antes de finalizar.'
            : 'Continúa para registrar tus datos y confirmar la compra.'}
        </div>

        <div className="grid gap-3 text-sm">
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>Con precio</span>
            <strong className="text-[var(--color-off-white)]">{summary.pricedItemCount}</strong>
          </div>
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>Por cotizar</span>
            <strong className="text-[var(--color-off-white)]">{summary.quoteItemCount}</strong>
          </div>
        </div>

        <div className="grid gap-3">
          {checkoutDisabled ? (
            <Button className="w-full" size="lg" disabled>
              Ir a checkout
            </Button>
          ) : (
            <Link href="/checkout">
              <Button className="w-full" size="lg">
                Finalizar compra
              </Button>
            </Link>
          )}
          <Link href="/productos">
            <Button variant="outline" className="w-full" size="lg">
              Seguir comprando
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
