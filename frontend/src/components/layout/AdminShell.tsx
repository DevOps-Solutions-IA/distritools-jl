'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminSessionExit } from '@/features/admin/shell/AdminSessionExit';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { AdminDrawer } from '@/features/admin/shell/AdminDrawer';
import { AdminModuleSearch } from '@/features/admin/shell/AdminModuleSearch';
import { AdminSessionFeedback } from '@/features/admin/shell/AdminSessionFeedback';
import { useAdminSession, type AdminSessionUser } from '@/features/admin/shell/useAdminSession';
import { adminModules, getAdminNavigationGroups, type AdminModuleConfig, type AdminNavigationGroup } from '@/lib/admin/transport/navigation';
import '@/styles/admin-shell.css';

interface AdminShellProps { children: React.ReactNode; }
const iconByModule: Record<AdminModuleConfig['key'], string> = {
  dashboard: 'DB', productos: 'PR', marcas: 'MA', categorias: 'CA', inventario: 'IN', precios: '$',
  pedidos: 'OR', cotizaciones: 'QT', clientes: 'CL', pagos: 'PY', envios: 'SH', rastreo: 'TR',
  notificaciones: 'NT', 'contenido-legal': 'LG', 'contenido-footer': 'FT', configuracion: 'CF',
  usuarios: 'US', roles: 'RL', auditoria: 'AU', reportes: 'RP',
};
function moduleIsActive(pathname: string, item: AdminModuleConfig) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarContent({ pathname, groups, user, onSessionExpired, onNavigate }: {
  pathname: string; groups: AdminNavigationGroup[]; user: AdminSessionUser | null; onSessionExpired: () => void; onNavigate?: () => void;
}) {
  return (
    <div className="admin-sidebar">
      <div className="admin-brand">
        <DistriToolsLogo variant="horizontal" tone="dark" size="sm" priority />
        <p>Operación interna</p>
      </div>
      <nav aria-label="Navegación administrativa" className="admin-navigation">
        {groups.map((group) => <section key={group.title}>
          <h2>{group.title}</h2>
          <ul>{group.items.map((item) => <li key={item.key}>
            <Link href={item.href} onClick={onNavigate} className="admin-nav-link" aria-current={moduleIsActive(pathname, item) ? 'page' : undefined}>
              <span aria-hidden="true" className="admin-nav-icon">{iconByModule[item.key]}</span>
              <span>{item.title}</span>
            </Link>
          </li>)}</ul>
        </section>)}
        {!groups.length ? <p className="admin-session-role">{user ? 'No tienes destinos autorizados.' : 'Verificación de sesión pendiente.'}</p> : null}
      </nav>
      {user ? <div className="admin-session" aria-label="Usuario de la sesión">
        <p className="admin-session-email">{user.email}</p>
        <p className="admin-session-role">{user.role}</p>
        <AdminSessionExit onSessionExpired={onSessionExpired} />
      </div> : null}
    </div>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname() ?? '';
  // Existing route wrappers share their canonical module, never an unknown fallback.
  const aliases: Record<string, string> = { '/admin': '/admin/dashboard', '/admin/contenido/legal': '/admin/legal', '/admin/contenido/footer': '/admin/footer' };
  const navigationPath = aliases[pathname] ?? pathname;
  const { state, retry } = useAdminSession(pathname);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [previousPathname, setPreviousPathname] = React.useState(pathname);
  const backgroundRef = React.useRef<HTMLDivElement>(null);
  const mainId = React.useId();
  if (previousPathname !== pathname) { setPreviousPathname(pathname); setMobileOpen(false); }

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (event.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  function expireSession() { setMobileOpen(false); retry(); }

  const user = state.status === 'success' ? state.user : null;
  const groups = user ? getAdminNavigationGroups(user.permissions) : [];
  const permittedModules = groups.flatMap((group) => group.items);
  const activeModule = adminModules.find((item) => moduleIsActive(navigationPath, item));
  const activePermitted = activeModule && permittedModules.some((item) => item.key === activeModule.key);
  const title = activeModule?.title ?? 'Administración';

  return (
    <div className="admin-workspace">
      <div ref={backgroundRef} className="admin-background">
        <a className="admin-skip-link" href={`#${mainId}`}>Ir al contenido</a>
        <aside className="admin-rail">
          <SidebarContent pathname={navigationPath} groups={groups} user={user} onSessionExpired={expireSession} />
        </aside>
        <div className="admin-body">
          <header className="admin-topbar">
            <div className="admin-context">
              <button type="button" className="admin-menu-trigger" aria-label="Abrir menú administrativo" aria-expanded={mobileOpen} aria-haspopup="dialog" onClick={() => setMobileOpen(true)}>
                <span aria-hidden="true">☰</span>
              </button>
              <div className="admin-context-title">
                <p>DistriTools JL · Administración</p>
                <h1>{title}</h1>
                <span className="admin-backend-status" data-state={user ? 'success' : state.status === 'loading' ? 'loading' : 'error'}>
                  {user ? 'Sesión verificada' : state.status === 'loading' ? 'Verificando sesión' : 'Sesión no verificada'}
                </span>
              </div>
            </div>
            {user && permittedModules.length ? <AdminModuleSearch modules={permittedModules} /> : null}
          </header>
          <main id={mainId} tabIndex={-1} className="admin-main">
            {state.status !== 'success' ? <AdminSessionFeedback status={state.status} onRetry={retry} />
              : !permittedModules.length ? <section className="admin-read-state" role="status"><h2>Sin módulos disponibles</h2><p>La sesión está verificada, pero no tiene permisos de lectura para los módulos del panel.</p><div className="admin-state-actions"><button type="button" onClick={retry}>Actualizar permisos</button></div></section>
                : !activePermitted ? <AdminSessionFeedback status="forbidden" onRetry={retry} />
                  : children}
          </main>
        </div>
      </div>
      {mobileOpen ? <AdminDrawer backgroundRef={backgroundRef} onClose={() => setMobileOpen(false)}>
        <SidebarContent pathname={navigationPath} groups={groups} user={user} onSessionExpired={expireSession} onNavigate={() => setMobileOpen(false)} />
      </AdminDrawer> : null}
    </div>
  );
}
