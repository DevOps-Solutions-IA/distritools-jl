import { adminFetch, AdminReadError } from '@/lib/admin/server-data';
import { adminContractFailure } from '@/lib/admin/transport/result';
import type { BackendProductRecord, BackendVariantRecord, BackendBrandRecord, BackendCategoryRecord } from '@/features/catalog/types';
export type CatalogProductRecord = BackendProductRecord & { isActive: boolean; updatedAt: string; metadata: Record<string, unknown> | null };
export type CatalogBrandRecord = BackendBrandRecord & { isActive: boolean };
export type CatalogCategoryRecord = BackendCategoryRecord & { isActive: boolean };
export type CatalogVariantRecord = BackendVariantRecord & { isActive: boolean };
export async function catalogRead<T>(path: string): Promise<T> {
  const result = await adminFetch<T>(path);
  if (!result.ok) throw new AdminReadError(result);
  return result.data;
}
export async function catalogCollection<T>(path: string): Promise<T[]> {
  const result = await catalogRead<{ data: T[] }>(path);
  if (!Array.isArray(result.data)) throw new AdminReadError(adminContractFailure(200));
  return result.data;
}
export async function catalogPermissions(): Promise<string[]> {
  const result = await catalogRead<{ user: { permissions: string[] } }>('/admin/session');
  if (!result.user || !Array.isArray(result.user.permissions) || !result.user.permissions.every((value) => typeof value === 'string')) throw new AdminReadError(adminContractFailure(200));
  return result.user.permissions;
}
export async function catalogOptions() {
  const permissions = await catalogPermissions();
  const [brands, categories, warehouses] = await Promise.all([
    permissions.includes('brands.read') ? catalogCollection<CatalogBrandRecord>('/admin/brands') : Promise.resolve([]),
    permissions.includes('categories.read') ? catalogCollection<CatalogCategoryRecord>('/admin/categories') : Promise.resolve([]),
    permissions.includes('inventory.read') ? catalogCollection<{ id: string; name: string; code: string }>('/admin/inventory/warehouses') : Promise.resolve([]),
  ]);
  return { permissions, brands, categories, warehouses };
}
