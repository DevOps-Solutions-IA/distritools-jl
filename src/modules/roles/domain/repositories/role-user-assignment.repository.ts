import { AdminUserState } from 'src/modules/users/domain/entities/admin-user.entity';

export interface RoleUserAssignmentRepository {
  findUserById(userId: string): Promise<AdminUserState | null>;
  assignRole(userId: string, roleId: string): Promise<AdminUserState>;
}

export const ROLE_USER_ASSIGNMENT_REPOSITORY = Symbol(
  'ROLE_USER_ASSIGNMENT_REPOSITORY',
);
