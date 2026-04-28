import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminUserEntity } from 'src/modules/users/domain/entities/admin-user.entity';
import { RoleReference } from 'src/modules/users/domain/repositories/role-reference.repository';

@Injectable()
export class UserPolicyService {
  ensureEmailIsAvailable(existing: AdminUserEntity | null, nextEmail: string): void {
    if (existing && existing.email.toLowerCase() === nextEmail.toLowerCase()) {
      throw new ConflictException('Admin email already exists');
    }
  }

  ensureRoleExists(role: RoleReference | null): asserts role is RoleReference {
    if (!role) {
      throw new NotFoundException('Role not found');
    }
  }
}
