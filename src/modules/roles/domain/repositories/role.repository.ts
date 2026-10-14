import type { Prisma } from '@prisma/client';
import { RoleState } from 'src/modules/roles/domain/entities/role.entity';

export interface CreateRoleRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateRoleRecord {
  id: string;
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface RoleRepository {
  findById(id: string, tx?: Prisma.TransactionClient): Promise<RoleState | null>;
  findBySlug(slug: string, tx?: Prisma.TransactionClient): Promise<RoleState | null>;
  create(data: CreateRoleRecord, tx?: Prisma.TransactionClient): Promise<RoleState>;
  update(data: UpdateRoleRecord, tx?: Prisma.TransactionClient): Promise<RoleState>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
