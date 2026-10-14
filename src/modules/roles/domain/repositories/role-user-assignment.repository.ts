import type { Prisma } from '@prisma/client';
import { AdminUserState } from 'src/modules/users/domain/entities/admin-user.entity';

export interface RoleUserAssignmentRepository {
  findUserById(userId: string, tx?: Prisma.TransactionClient): Promise<AdminUserState | null>;
  assignRole(userId: string, roleId: string, tx?: Prisma.TransactionClient): Promise<AdminUserState>;
}

export const ROLE_USER_ASSIGNMENT_REPOSITORY = Symbol(
  'ROLE_USER_ASSIGNMENT_REPOSITORY',
);
