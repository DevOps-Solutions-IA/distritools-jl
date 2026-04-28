'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

interface CheckoutSuccessStateProps {
  orderNumber: string;
  message?: string;
}

export function CheckoutSuccessState({
  orderNumber,
  message,
}: CheckoutSuccessStateProps) {
  return (
    <Card className="border-[rgba(22,163,74,0.16)] bg-[rgba(22,163,74,0.04)]">
      <CardBody className="space-y-4">
        <h2 className="text-2xl font-semibold text-[var(--color-graphite-black)]">
          Orden creada correctamente
        </h2>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          Pedido <strong>{orderNumber}</strong>. {message ?? 'La confirmación final del pago depende del backend y sus webhooks.'}
        </p>
        <Link href={`/storefront/orden/${orderNumber}`}>
          <Button>Ver orden</Button>
        </Link>
      </CardBody>
    </Card>
  );
}
