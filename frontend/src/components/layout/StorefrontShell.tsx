import * as React from 'react';
import Link from 'next/link';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { MobileNavigationDrawer } from '@/components/layout/MobileNavigationDrawer';
import { StorefrontFooter } from '@/components/layout/StorefrontFooter';
import { GlobalLiveSearch } from '@/components/storefront/GlobalLiveSearch';
import { WhatsAppFloatingButton } from '@/components/storefront/WhatsAppFloatingButton';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils/cn';

interface StorefrontShellProps {
  children: React.ReactNode;
  className?: string;
}

export function StorefrontShell({ children, className }: StorefrontShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-off-white)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[rgba(5,5,5,0.97)] backdrop-blur-xl">
        <div className="enterprise-grid flex flex-col gap-2 py-2 xl:gap-3 xl:py-3">
          <div className="flex items-center justify-between gap-3 xl:hidden">
            <MobileNavigationDrawer />
            <Link
              href="/"
              className="flex min-w-0 items-center rounded-xl transition opacity-95 hover:opacity-100"
            >
              <DistriToolsLogo
                variant="horizontal"
                tone="dark"
                size="sm"
                priority
                className="h-8 w-[9.75rem] max-w-[52vw]"
              />
            </Link>
            <CartDrawer />
          </div>

          <div className="xl:hidden">
            <GlobalLiveSearch compact name="global-product-search" placeholder="Buscar productos" />
          </div>

          <div className="hidden gap-4 xl:grid xl:grid-cols-[auto_minmax(24rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Link
                href="/"
                className="flex w-fit items-center rounded-xl transition opacity-95 hover:opacity-100"
              >
                <DistriToolsLogo
                  variant="horizontal"
                  tone="dark"
                  size="sm"
                  priority
                  className="h-10 w-[12.5rem] max-w-full sm:h-11 sm:w-[14rem]"
                />
              </Link>
              <p className="pl-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--color-industrial-yellow)] sm:text-[10px]">
                Herramientas que construyen resultados
              </p>
            </div>

            <GlobalLiveSearch
              name="desktop-global-product-search"
              placeholder="Buscar productos, marcas o líneas"
            />

            <div className="flex items-center justify-between gap-3 xl:justify-end">
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.055] px-5 text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)] hover:bg-white/10"
              >
                Asesoría
              </a>
              <CartDrawer />
            </div>
          </div>

          <nav className="hidden flex-wrap items-center gap-2 border-t border-white/6 pt-3 xl:flex">
            {[
              { label: 'Inicio', href: '/' },
              { label: 'Productos', href: '/productos' },
              { label: 'Marcas', href: '/marcas' },
              { label: 'Categorías', href: '/categorias' },
              { label: 'Rastreo', href: '/rastreo-de-pedido' },
              { label: 'Contacto', href: '/contacto' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-white/5 hover:text-[var(--color-off-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-industrial-yellow)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className={cn('enterprise-grid py-5 sm:py-7 lg:py-10', className)}>{children}</main>
      <StorefrontFooter />
      <WhatsAppFloatingButton />
    </div>
  );
}
