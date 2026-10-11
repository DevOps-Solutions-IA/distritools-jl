'use client';
import { createContext, type ReactNode } from 'react';
import { useAdminSession } from '@/features/admin/shell/useAdminSession';
/** Advisory UI gate only. Every backend operation retains its own RBAC guard. */
export function useCatalogPermissions(context: string) {
  const { state, retry } = useAdminSession(`catalog:${context}`);
  return { pending: state.status === 'loading', state, retry, can: (permission: string) => state.status === 'success' && state.user.permissions.includes(permission) };
}
export const CatalogPermissionContext = createContext<ReturnType<typeof useCatalogPermissions> | null>(null);
/** One current session read for all actions in a catalog table, rather than one per row. */
export function CatalogPermissionProvider({ children }: { children: ReactNode }) {
  const permissions = useCatalogPermissions('product-list');
  return <CatalogPermissionContext.Provider value={permissions}>{children}</CatalogPermissionContext.Provider>;
}
