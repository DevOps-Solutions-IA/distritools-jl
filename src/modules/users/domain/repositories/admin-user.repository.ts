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
  findById(id: string): Promise<AdminUserState | null>;
  findByEmail(email: string): Promise<AdminUserState | null>;
  create(data: CreateAdminUserRecord): Promise<AdminUserState>;
  update(data: UpdateAdminUserRecord): Promise<AdminUserState>;
}

export const ADMIN_USER_REPOSITORY = Symbol('ADMIN_USER_REPOSITORY');
