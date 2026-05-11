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
        'focus-ring fixed right-4 z-40 inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(245,183,0,0.5)] bg-[#18b857] font-semibold text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)] transition hover:-translate-y-0.5 hover:bg-[#149e4a]',
        compact
          ? 'bottom-24 h-11 px-3 text-xs sm:bottom-5 sm:h-12 sm:px-4 sm:text-sm'
          : 'bottom-5 h-12 px-4 text-sm sm:h-13 sm:px-5',
      )}
    >
      <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-white/16 text-xs">
        WA
      </span>
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>
        {storefrontContactConfig.whatsappDisplay}
      </span>
    </a>
  );
}
