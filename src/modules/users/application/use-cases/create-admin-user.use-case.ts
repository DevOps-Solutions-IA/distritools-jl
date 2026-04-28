import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
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
import { AdminUserEntity } from 'src/modules/users/domain/entities/admin-user.entity';

export interface CreateAdminUserInput {
  actor: CurrentUser;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  roleId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateAdminUserUseCase {
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

  async execute(input: CreateAdminUserInput) {
    assertHasPermissions(input.actor.permissions, ['users.create']);

    const normalizedEmail = input.email.trim().toLowerCase();
    const [existingUser, role] = await Promise.all([
      this.adminUserRepository.findByEmail(normalizedEmail),
      this.roleReferenceRepository.findById(input.roleId),
    ]);

    this.userPolicyService.ensureEmailIsAvailable(
      existingUser ? AdminUserEntity.fromState(existingUser) : null,
      normalizedEmail,
    );
    this.userPolicyService.ensureRoleExists(role);

    const user = await this.adminUserRepository.create({
      id: uuidv7(),
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      passwordHash: await this.passwordHashingService.hash(input.password),
      phone: input.phone?.trim() || null,
      roleId: input.roleId,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'users.admin.created',
      entityType: 'user',
      entityId: user.id,
      afterData: user,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return user;
  }
}
