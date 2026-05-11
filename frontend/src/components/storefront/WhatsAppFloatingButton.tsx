'use client';

import { usePathname } from 'next/navigation';
import { getStorefrontWhatsappUrl, storefrontContactConfig } from '@/config/storefront-contact';
import { cn } from '@/lib/utils/cn';

const reducedRoutes = ['/carrito', '/checkout', '/checkout/confirmacion'];

export function WhatsAppFloatingButton() {
  const pathname = usePathname();
  const compact = reducedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <a
      href={getStorefrontWhatsappUrl()}
      target="_blank"
      rel="noreferrer"
      aria-label="Escribir por WhatsApp"
      className={cn(
        'focus-ring fixed right-4 z-40 inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,225,122,0.55)] bg-[var(--color-industrial-yellow)] font-semibold text-[#050505] shadow-[0_18px_48px_rgba(0,0,0,0.46)] ring-1 ring-black/20 transition hover:-translate-y-0.5 hover:bg-[var(--color-action-primary-hover)]',
        compact
          ? 'bottom-24 h-11 px-3 text-xs sm:bottom-5 sm:h-12 sm:px-4 sm:text-sm'
          : 'bottom-5 h-12 px-4 text-sm sm:h-13 sm:px-5',
      )}
    >
      <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-[#050505] text-[10px] font-black text-[var(--color-industrial-yellow)]">
        WA
      </span>
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>
        {storefrontContactConfig.whatsappDisplay}
      </span>
    </a>
  );
}
