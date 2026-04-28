import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { AdminUserEntity } from 'src/modules/users/domain/entities/admin-user.entity';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from 'src/modules/users/domain/repositories/admin-user.repository';
import {
  ROLE_REFERENCE_REPOSITORY,
  RoleReferenceRepository,
} from 'src/modules/users/domain/repositories/role-reference.repository';
import { PasswordHashingService } from 'src/modules/users/domain/services/password-hashing.service';
import { UserPolicyService } from 'src/modules/users/domain/services/user-policy.service';

export interface UpdateAdminUserInput {
  actor: CurrentUser;
  userId: string;
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string | null;
  roleId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminUserRepository: AdminUserRepository,
    @Inject(ROLE_REFERENCE_REPOSITORY)
    private readonly roleReferenceRepository: RoleReferenceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    private readonly passwordHashingService: PasswordHashingService,
    private readonly userPolicyService: UserPolicyService,
  ) {}

  async execute(input: UpdateAdminUserInput) {
    assertHasPermissions(input.actor.permissions, ['users.update']);

    const existingRecord = await this.adminUserRepository.findById(input.userId);

    if (!existingRecord) {
      throw new NotFoundException('Admin user not found');
    }

    const existingUser = AdminUserEntity.fromState(existingRecord);
    const nextEmail = input.email?.trim().toLowerCase();

    if (nextEmail && nextEmail !== existingUser.email.toLowerCase()) {
      const conflictingUser = await this.adminUserRepository.findByEmail(nextEmail);
      this.userPolicyService.ensureEmailIsAvailable(
        conflictingUser ? AdminUserEntity.fromState(conflictingUser) : null,
        nextEmail,
      );
    }

    if (input.roleId) {
      const role = await this.roleReferenceRepository.findById(input.roleId);
      this.userPolicyService.ensureRoleExists(role);
    }

    const updatedUser = await this.adminUserRepository.update({
      id: input.userId,
      fullName: input.fullName?.trim(),
      email: nextEmail,
      passwordHash: input.password
        ? await this.passwordHashingService.hash(input.password)
        : undefined,
      phone:
        input.phone === undefined ? undefined : input.phone?.trim() || null,
      roleId: input.roleId,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'users.admin.updated',
      entityType: 'user',
      entityId: updatedUser.id,
      beforeData: existingRecord,
      afterData: updatedUser,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return updatedUser;
  }
}
