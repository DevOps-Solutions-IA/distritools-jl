'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GlobalLiveSearch } from '@/components/storefront/GlobalLiveSearch';
import { cn } from '@/lib/utils/cn';

const mobileLinks = [
  { label: 'Inicio', href: '/' },
  { label: 'Productos', href: '/productos' },
  { label: 'Marcas', href: '/marcas' },
  { label: 'Líneas de producto', href: '/categorias' },
  { label: 'Rastreo', href: '/rastreo-de-pedido' },
  { label: 'Contacto', href: '/contacto' },
  { label: 'Carrito', href: '/carrito' },
];

const categoryLinks = [
  { label: 'Compresores y aire', href: '/productos?category=compresores' },
  { label: 'Fijación industrial', href: '/productos?category=fijacion' },
  { label: 'Soldadura y corte', href: '/productos?category=soldadura' },
  { label: 'Herramientas manuales', href: '/productos?category=herramientas-manuales' },
  { label: 'Herramientas eléctricas', href: '/productos?category=herramientas-electricas' },
  { label: 'Herramientas neumáticas', href: '/productos?category=herramientas-neumaticas' },
  { label: 'Abrasivos', href: '/productos?q=abrasivos' },
  { label: 'Plomería', href: '/productos?q=plomeria' },
  { label: 'Escaleras', href: '/productos?q=escaleras' },
  { label: 'Bombas', href: '/productos?category=bombas' },
];

export function MobileNavigationDrawer() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.querySelector<HTMLElement>('button, a[href], input')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])',
      );

      if (!focusable?.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-11 w-11 rounded-full p-0 xl:hidden"
        aria-label="Abrir menú principal"
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/72 backdrop-blur-sm xl:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            className="h-dvh w-[min(82vw,21rem)] overflow-y-auto border-r border-[var(--color-border)] bg-[#050505] bg-[linear-gradient(180deg,#111_0%,#050505_100%)] p-4 shadow-elevated"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  DistriTools JL
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--color-off-white)]">
                  Menú
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 rounded-full p-0 text-xl"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              >
                ×
              </Button>
            </div>

            <div className="mb-4">
              <GlobalLiveSearch
                compact
                name="mobile-menu-search"
                placeholder="Buscar producto o marca"
                onNavigate={() => setOpen(false)}
              />
            </div>

            <nav className="grid gap-2" aria-label="Menú móvil">
              {mobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)]',
                    pathname === link.href
                      ? 'border-[var(--color-industrial-yellow)] bg-[rgba(245,183,0,0.12)]'
                      : 'border-white/8 bg-white/[0.035]',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <details className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-off-white)]">
                  Explorar líneas
                </summary>
                <div className="mt-3 grid gap-2">
                  {categoryLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={`Abrir línea de producto ${link.label}`}
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-white/8 px-3 py-2.5 text-sm font-semibold leading-snug text-[var(--color-text-secondary)] transition hover:border-[var(--color-industrial-yellow)] hover:text-[var(--color-off-white)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
              <p className="px-1 pt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                La información legal está disponible en el footer para no saturar el menú de compra.
              </p>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
