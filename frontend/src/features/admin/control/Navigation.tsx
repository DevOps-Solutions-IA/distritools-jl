'use client';
import { createContext, useContext, type ReactNode } from 'react';
import Link from 'next/link';
import { useAdminSession } from '@/features/admin/shell/useAdminSession';
const Authority = createContext<ReturnType<typeof useAdminSession>['state'] | null>(null);
export function ControlNavigation({ context, children }: { context: string; children: ReactNode }) {
  const { state } = useAdminSession(`control:${context}`);
  return <Authority.Provider value={state}>{children}</Authority.Provider>;
}
function targetPermissions(href: string): string[] {
  const path = href.split('?')[0];
  if (path.startsWith('/admin/productos/nuevo')) return ['catalog.read', 'products.write'];
  if (path.startsWith('/admin/productos')) return ['catalog.read', 'products.read'];
  const routes: Record<string, string> = { reportes: 'reports.read', dashboard: 'dashboard.read', inventario: 'inventory.read', pedidos: 'orders.read', envios: 'shipping.read', rastreo: 'tracking.read', pagos: 'payments.read', auditoria: 'audit.read', configuracion: 'settings.read', notificaciones: 'notifications.read', roles: 'permissions.read' };
  return routes[path.split('/')[2]] ? [routes[path.split('/')[2]]] : [];
}
/** Advisory current-session gate; the destination's existing backend guards remain authoritative. */
export function ControlLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const state = useContext(Authority); const required = targetPermissions(href);
  if (state?.status === 'success' && required.length && required.every(permission => state.user.permissions.includes(permission))) return <Link href={href} className={className}>{children}</Link>;
  return <div className={className} aria-disabled="true">{children}<span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{state?.status === 'loading' ? 'Verificando permisos…' : state?.status === 'success' ? required.length ? `Requiere ${required.join(', ')}` : 'Destino de navegación no reconocido.' : 'Permisos de navegación no disponibles.'}</span></div>;
}
