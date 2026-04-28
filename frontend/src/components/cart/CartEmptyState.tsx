'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function CartEmptyState() {
  return (
    <div className="space-y-4">
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega productos desde el catálogo para continuar con tu compra."
      />
      <Link href="/storefront/productos">
        <Button className="w-full sm:w-auto">Explorar catálogo</Button>
      </Link>
    </div>
  );
}
