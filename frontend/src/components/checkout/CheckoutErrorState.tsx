'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export function CheckoutErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-[1.15rem] border-[rgba(220,38,38,0.24)] bg-[rgba(220,38,38,0.055)] p-4 text-left sm:p-5">
      <div className="grid gap-3">
        <div>
          <p className="w-fit rounded-full bg-[rgba(220,38,38,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-error-red)]">
            Error operativo
          </p>
          <h3 className="mt-3 text-lg font-semibold text-[var(--color-off-white)]">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {description}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Tu pedido no fue enviado y ningún cobro fue procesado.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <a
            href="#checkout-contact-data"
            className="focus-ring inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-industrial-yellow)] px-4 text-sm font-semibold text-[#111111]"
          >
            Revisar datos
          </a>
          <Link
            href="/carrito"
            className="focus-ring inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.055] px-4 text-sm font-semibold text-[var(--color-off-white)]"
          >
            Volver al carrito
          </Link>
          <Link
            href="/contacto"
            className="focus-ring col-span-2 inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.035] px-4 text-sm font-semibold text-[var(--color-off-white)] sm:col-span-1"
          >
            Contactar soporte
          </Link>
        </div>
      </div>
    </Card>
  );
}
