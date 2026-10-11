import type { AdminModuleKey } from '@/lib/admin/transport/navigation';
import type { AdminReadQuery } from '@/lib/admin/server-data';
export type SectionSearchParams = Record<string, string | string[] | undefined>;
// Whitelists follow each selected backend controller's actual @Query contract.
export const sectionQueryKeys: Partial<
  Record<AdminModuleKey, readonly string[]>
> = {
  pedidos: ['page', 'limit', 'search', 'direction', 'status', 'paymentStatus'],
  cotizaciones: ['page', 'limit', 'search', 'direction', 'status'],
  clientes: ['page', 'limit', 'search', 'direction'],
  pagos: ['page', 'limit', 'direction', 'status', 'gateway'],
  envios: ['page', 'limit', 'search', 'direction', 'status'],
  rastreo: ['page', 'limit', 'search', 'direction', 'status'],
  auditoria: ['action', 'entityType', 'entityId', 'limit'],
  inventario: ['search'],
};
export function filterSectionQuery(
  moduleKey: AdminModuleKey,
  params: SectionSearchParams,
): AdminReadQuery {
  const result: Record<string, string> = {};
  for (const key of sectionQueryKeys[moduleKey] ?? []) {
    const value = params[key];
    if (typeof value === 'string' && value) result[key] = value;
  }
  return result;
}
export function paginationMeta(
  value: unknown,
): { page: number; limit: number; total: number } | null {
  if (!value || typeof value !== 'object' || !('meta' in value)) return null;
  const meta = value.meta;
  if (
    !meta ||
    typeof meta !== 'object' ||
    !('page' in meta) ||
    !('limit' in meta) ||
    !('total' in meta)
  )
    return null;
  if (
    typeof meta.page !== 'number' ||
    typeof meta.limit !== 'number' ||
    typeof meta.total !== 'number' ||
    !Number.isInteger(meta.page) ||
    !Number.isInteger(meta.limit) ||
    !Number.isInteger(meta.total) ||
    meta.page < 1 ||
    meta.limit < 1 ||
    meta.total < 0
  )
    return null;
  return { page: meta.page, limit: meta.limit, total: meta.total };
}
