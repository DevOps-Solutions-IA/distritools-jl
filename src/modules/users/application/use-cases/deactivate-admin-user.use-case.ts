import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

export interface DeactivateAdminUserInput {
  actor: CurrentUser;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DeactivateAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminUserRepository: AdminUserRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: DeactivateAdminUserInput) {
    assertHasPermissions(input.actor.permissions, ['users.deactivate']);

    if (input.actor.sub === input.userId) {
      throw new ConflictException('Admins cannot deactivate themselves');
    }

    const existingRecord = await this.adminUserRepository.findById(input.userId);

    if (!existingRecord) {
      throw new NotFoundException('Admin user not found');
    }

    const existingUser = AdminUserEntity.fromState(existingRecord);
    existingUser.ensureActiveTransitionAllowed(false);

    const updatedUser = await this.adminUserRepository.update({
      id: input.userId,
      isActive: false,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'users.admin.deactivated',
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
