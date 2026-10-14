import type { Prisma } from '@prisma/client';
export interface PermissionRoleReference {
  id: string;
  name: string;
  slug: string;
}

export interface PermissionRoleReferenceRepository {
  findRoleById(roleId: string, tx?: Prisma.TransactionClient): Promise<PermissionRoleReference | null>;
}

export const PERMISSION_ROLE_REFERENCE_REPOSITORY = Symbol(
  'PERMISSION_ROLE_REFERENCE_REPOSITORY',
);
