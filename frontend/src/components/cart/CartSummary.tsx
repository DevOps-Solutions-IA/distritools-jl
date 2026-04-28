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
    <Card variant="elevated" className="sticky top-6">
      <CardBody className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            Resumen
          </p>
          <h2 className="text-2xl font-semibold text-[var(--color-off-white)]">
            {summary.subtotalLabel}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {summary.itemCount} unidades en el carrito.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
          Continúa a checkout para registrar tus datos y confirmar la solicitud de compra.
        </div>

        <div className="grid gap-3">
          {checkoutDisabled ? (
            <Button className="w-full" size="lg" disabled>
              Ir a checkout
            </Button>
          ) : (
            <Link href="/storefront/checkout">
              <Button className="w-full" size="lg">
                Ir a checkout
              </Button>
            </Link>
          )}
          <Link href="/storefront/productos">
            <Button variant="outline" className="w-full" size="lg">
              Seguir comprando
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
