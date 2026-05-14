'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { Badge } from '@/components/ui/Badge';
import {
  adminModules,
  adminNavigationGroups,
  adminStatusLabel,
  adminStatusVariant,
  isAdminModuleReady,
  type AdminModuleConfig,
} from '@/lib/admin/operations';
import { cn } from '@/lib/utils/cn';

interface AdminShellProps {
  children: React.ReactNode;
}

const iconByModule: Record<AdminModuleConfig['key'], string> = {
  dashboard: 'DB',
  productos: 'PR',
  marcas: 'MA',
  categorias: 'CA',
  inventario: 'IN',
  precios: '$',
  pedidos: 'OR',
  cotizaciones: 'QT',
  clientes: 'CL',
  pagos: 'PY',
  envios: 'SH',
  rastreo: 'TR',
  notificaciones: 'NT',
  'contenido-legal': 'LG',
  'contenido-footer': 'FT',
  configuracion: 'CF',
  usuarios: 'US',
  roles: 'RL',
  auditoria: 'AU',
  reportes: 'RP',
};

function moduleIsActive(pathname: string, item: AdminModuleConfig) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarContent({
  pathname,
  onNavigate,
  showSessionBadge = true,
}: {
  pathname: string;
  onNavigate?: () => void;
  showSessionBadge?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-5 border-b border-white/10 px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <DistriToolsLogo variant="mark" tone="light" size="sm" priority />
          {showSessionBadge ? <Badge variant="info">Admin</Badge> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            Operación interna
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Plataforma protegida por sesión y permisos.
          </p>
        </div>
      </div>

      <nav
        aria-label="Navegación administrativa"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
      >
        <div className="grid gap-6">
          {adminNavigationGroups.map((group) => (
            <section key={group.title} className="space-y-2">
              <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                {group.title}
              </p>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const active = moduleIsActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-industrial-yellow)]',
                        active
                          ? 'bg-[rgba(245,183,0,0.15)] text-[var(--color-off-white)] ring-1 ring-[rgba(245,183,0,0.35)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--color-off-white)]',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-xs',
                            active
                              ? 'border-[rgba(245,183,0,0.4)] bg-[rgba(245,183,0,0.18)] text-[var(--color-industrial-yellow)]'
                              : 'border-white/10 bg-white/[0.03] text-[var(--color-text-secondary)] group-hover:text-[var(--color-industrial-yellow)]',
                          )}
                        >
                          {iconByModule[item.key]}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </span>
                      {!isAdminModuleReady(item.status) ? (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-[var(--color-amber-highlight)]">
                          {adminStatusLabel(item.status)}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
            Sesión
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-off-white)]">Acceso interno</p>
          <div className="mt-3">
            <AdminLogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname() ?? '/admin/dashboard';
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [adminSearch, setAdminSearch] = React.useState('');
  const activeModule = adminModules.find((item) => moduleIsActive(pathname, item)) ?? adminModules[0];

  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function submitAdminSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = adminSearch.trim().toLowerCase();
    if (!query) {
      return;
    }

    const targetModule = adminModules.find((item) =>
      [item.title, item.key, item.description, item.permission]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );

    router.push(targetModule?.href ?? `/admin/reportes?search=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-off-white)] lg:grid lg:grid-cols-[19.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-white/10 bg-[#080808] lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[rgba(12,12,12,0.92)] backdrop-blur">
          <div className="enterprise-grid flex items-center justify-between gap-4 py-3 lg:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--color-off-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-industrial-yellow)] lg:hidden"
                aria-label="Abrir menú administrativo"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <span aria-hidden="true" className="text-xl leading-none">=</span>
              </button>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  {activeModule.permission}
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
                  {activeModule.title}
                </h1>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <form
                onSubmit={submitAdminSearch}
                role="search"
                className="hidden min-w-[14rem] sm:block"
              >
                <label className="sr-only" htmlFor="admin-global-search">
                  Buscar en admin
                </label>
                <input
                  id="admin-global-search"
                  value={adminSearch}
                  onChange={(event) => setAdminSearch(event.target.value)}
                  placeholder="Buscar módulo"
                  autoComplete="off"
                  className="focus-ring h-10 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-[var(--color-off-white)] placeholder:text-[var(--color-text-secondary)]"
                />
              </form>
              <Link
                href="/admin/dashboard?range=30d"
                className="hidden rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-industrial-yellow)] hover:text-[var(--color-off-white)] md:inline-flex"
              >
                30 días
              </Link>
              <Badge variant={adminStatusVariant(activeModule.status)}>
                {adminStatusLabel(activeModule.status)}
              </Badge>
              <span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] sm:inline-flex">
                Local
              </span>
            </div>
          </div>
        </header>

        <main className="enterprise-grid py-5 sm:py-8">{children}</main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú administrativo">
          <button
            type="button"
            aria-label="Cerrar menú administrativo"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[min(88vw,22rem)] overflow-hidden border-r border-white/10 bg-[#080808] shadow-[30px_0_90px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-[var(--color-off-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-industrial-yellow)]"
              aria-label="Cerrar menú administrativo"
              onClick={() => setMobileOpen(false)}
            >
              x
            </button>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              showSessionBadge={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
