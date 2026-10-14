import type { Prisma } from '@prisma/client';
export interface RoleReference {
  id: string;
  name: string;
  slug: string;
}

export interface RoleReferenceRepository {
  findById(id: string, tx?: Prisma.TransactionClient): Promise<RoleReference | null>;
}

export const ROLE_REFERENCE_REPOSITORY = Symbol('ROLE_REFERENCE_REPOSITORY');
