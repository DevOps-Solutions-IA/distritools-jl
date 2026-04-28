import * as React from 'react';
import Link from 'next/link';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { StorefrontFooter } from '@/components/layout/StorefrontFooter';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils/cn';

interface StorefrontShellProps {
  children: React.ReactNode;
  className?: string;
}

export function StorefrontShell({ children, className }: StorefrontShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-off-white)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[rgba(5,5,5,0.92)] backdrop-blur-xl">
        <div className="enterprise-grid flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2">
              <Link
                href="/storefront"
                className="flex items-center rounded-[1.4rem] border border-white/8 bg-[rgba(255,255,255,0.02)] px-5 py-3 transition hover:border-white/14 hover:bg-[rgba(255,255,255,0.04)]"
              >
                <DistriToolsLogo
                  variant="horizontal"
                  tone="dark"
                  size="lg"
                  priority
                  className="h-[5.2rem] w-[24rem] max-w-full"
                />
              </Link>
              <p className="pl-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-industrial-yellow)]">
                Herramientas que construyen resultados
              </p>
            </div>

            <form action="/storefront/buscar" className="grid gap-3 xl:min-w-[30rem] xl:grid-cols-[1fr_auto]">
              <Input
                name="q"
                aria-label="Búsqueda comercial"
                placeholder="Busca por producto, marca, familia o categoría"
              />
              <Button size="lg" type="submit">
                Buscar
              </Button>
            </form>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/6 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap items-center gap-2">
              {[{ label: 'Productos', href: '/storefront/productos' }, { label: 'Marcas', href: '/storefront/marcas' }].map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost">{item.label}</Button>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'md' })}
              >
                Asesoría comercial
              </a>
              <CartDrawer />
            </div>
          </div>
        </div>
      </header>

      <main className={cn('enterprise-grid py-10', className)}>{children}</main>
      <StorefrontFooter />
    </div>
  );
}
