import { IAM_UNIT_OF_WORK, IamUnitOfWork } from 'src/modules/users/application/ports/iam-unit-of-work.port';
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
    @Inject(PasswordHashingService)
    private readonly passwordHashingService: PasswordHashingService,
    @Inject(UserPolicyService)
    private readonly userPolicyService: UserPolicyService,
    @Inject(IAM_UNIT_OF_WORK)
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(input: UpdateAdminUserInput) {
    assertHasPermissions(input.actor.permissions, ['users.update']);

    return this.unitOfWork.run(async (tx) => {
      const existingRecord = await this.adminUserRepository.findById(input.userId, tx);

      if (!existingRecord) {
        throw new NotFoundException('Admin user not found');
      }

      const existingUser = AdminUserEntity.fromState(existingRecord);
      const nextEmail = input.email?.trim().toLowerCase();

      if (nextEmail && nextEmail !== existingUser.email.toLowerCase()) {
        const conflictingUser = await this.adminUserRepository.findByEmail(nextEmail, tx);
        this.userPolicyService.ensureEmailIsAvailable(
          conflictingUser ? AdminUserEntity.fromState(conflictingUser) : null,
          nextEmail,
        );
      }

      if (input.roleId) {
        const role = await this.roleReferenceRepository.findById(input.roleId, tx);
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
      }, tx);

      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'users.admin.updated',
        entityType: 'user',
        entityId: updatedUser.id,
        beforeData: existingRecord,
        afterData: updatedUser,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);

      return updatedUser;
    }, { userId: input.userId, uniqueKey: input.email ? `iam-email:${input.email.trim().toLowerCase()}` : undefined, authorization: { actorUserId: input.actor.sub, requiredPermissions: ['users.update'] }, protection: { operation: 'users.admin.updated', entityType: 'user', entityId: input.userId, userId: input.userId, nextRoleId: input.roleId, ipAddress: input.ipAddress, userAgent: input.userAgent } });
  }
}
