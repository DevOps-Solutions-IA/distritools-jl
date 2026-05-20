'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStorefrontWhatsappUrl, storefrontContactConfig } from '@/config/storefront-contact';
import { cn } from '@/lib/utils/cn';

const reducedRoutes = ['/carrito', '/checkout', '/checkout/confirmacion', '/productos'];

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-6 w-6"
      fill="none"
    >
      <path
        d="M16 4.2A11.4 11.4 0 0 0 6.1 21.3L4.9 27l5.8-1.5A11.4 11.4 0 1 0 16 4.2Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M11.7 10.9c-.3.2-1.3 1-1.3 2.5 0 1.5 1.1 3.9 3.2 5.8 2.3 2.1 4.7 2.6 5.8 2.4 1.1-.2 2.2-1.1 2.4-1.8.2-.6.2-1.3.1-1.5-.1-.2-.3-.3-.7-.5l-2.1-1c-.3-.1-.6-.2-.9.2l-.8 1c-.2.2-.4.3-.8.1-.4-.2-1.6-.6-2.9-1.9-1.1-1.1-1.8-2.3-2-2.7-.2-.4 0-.6.2-.8l.6-.7c.2-.3.3-.5.2-.8l-.9-2.2c-.2-.4-.4-.4-.7-.4h-.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
        'focus-ring group fixed right-4 z-30 inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,225,122,0.55)] bg-[var(--color-industrial-yellow)] font-semibold text-[#050505] shadow-[0_18px_48px_rgba(0,0,0,0.46)] ring-1 ring-black/20 transition hover:-translate-y-0.5 hover:bg-[var(--color-action-primary-hover)]',
        compact
          ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom))] h-11 w-11 p-0 text-xs sm:bottom-5 sm:h-12 sm:w-auto sm:px-4 sm:text-sm'
          : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))] h-12 px-4 text-sm sm:h-13 sm:px-5',
      )}
    >
      <span className="motion-safe-whatsapp-pulse pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--color-industrial-yellow)] opacity-25 motion-safe:animate-[whatsappPulse_2.2s_ease-out_infinite]" />
      <span className="grid h-8 w-8 place-items-center rounded-full text-[#050505]">
        <WhatsAppIcon />
      </span>
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>
        {storefrontContactConfig.whatsappDisplay}
      </span>
    </a>
  );
}
