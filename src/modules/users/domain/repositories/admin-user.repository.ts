import type { Prisma } from '@prisma/client';
import { AdminUserState } from 'src/modules/users/domain/entities/admin-user.entity';

export interface CreateAdminUserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  roleId: string;
}

export interface UpdateAdminUserRecord {
  id: string;
  fullName?: string;
  email?: string;
  passwordHash?: string;
  phone?: string | null;
  roleId?: string;
  isActive?: boolean;
}

export interface AdminUserRepository {
  findById(id: string, tx?: Prisma.TransactionClient): Promise<AdminUserState | null>;
  findByEmail(email: string, tx?: Prisma.TransactionClient): Promise<AdminUserState | null>;
  create(data: CreateAdminUserRecord, tx?: Prisma.TransactionClient): Promise<AdminUserState>;
  update(data: UpdateAdminUserRecord, tx?: Prisma.TransactionClient): Promise<AdminUserState>;
}

export const ADMIN_USER_REPOSITORY = Symbol('ADMIN_USER_REPOSITORY');
