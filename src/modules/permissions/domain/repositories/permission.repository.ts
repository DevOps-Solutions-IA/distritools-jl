import type { Prisma } from '@prisma/client';
export interface PermissionCatalogEntry {
  id: string;
  name: string;
  slug: string;
  module: string;
  description: string | null;
}

export interface PermissionRepository {
  findBySlugs(slugs: string[], tx?: Prisma.TransactionClient): Promise<PermissionCatalogEntry[]>;
  listAll(tx?: Prisma.TransactionClient): Promise<PermissionCatalogEntry[]>;
}

export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');
