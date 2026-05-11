'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStorefrontWhatsappUrl, storefrontContactConfig } from '@/config/storefront-contact';
import { cn } from '@/lib/utils/cn';

const reducedRoutes = ['/carrito', '/checkout', '/checkout/confirmacion'];

export function WhatsAppFloatingButton() {
  const pathname = usePathname();
  const compact = reducedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!compact) {
      return;
    }

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        setInputFocused(true);
      }
    };
    const onFocusOut = () => setInputFocused(false);

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, [compact]);

  if (compact && inputFocused) {
    return null;
  }

  return (
    <a
      href={getStorefrontWhatsappUrl()}
      target="_blank"
      rel="noreferrer"
      aria-label="Escribir por WhatsApp"
      className={cn(
        'focus-ring fixed right-4 z-30 inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,225,122,0.55)] bg-[var(--color-industrial-yellow)] font-semibold text-[#050505] shadow-[0_18px_48px_rgba(0,0,0,0.46)] ring-1 ring-black/20 transition hover:-translate-y-0.5 hover:bg-[var(--color-action-primary-hover)]',
        compact
          ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom))] h-11 w-11 p-0 text-xs sm:bottom-5 sm:h-12 sm:w-auto sm:px-4 sm:text-sm'
          : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))] h-12 px-4 text-sm sm:h-13 sm:px-5',
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
