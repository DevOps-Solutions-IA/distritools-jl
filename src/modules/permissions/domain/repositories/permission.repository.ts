export interface PermissionCatalogEntry {
  id: string;
  name: string;
  slug: string;
  module: string;
  description: string | null;
}

export interface PermissionRepository {
  findBySlugs(slugs: string[]): Promise<PermissionCatalogEntry[]>;
  listAll(): Promise<PermissionCatalogEntry[]>;
}

export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');
