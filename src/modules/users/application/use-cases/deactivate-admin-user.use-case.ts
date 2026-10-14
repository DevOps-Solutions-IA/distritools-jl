import { IAM_UNIT_OF_WORK, IamUnitOfWork } from 'src/modules/users/application/ports/iam-unit-of-work.port';
import {
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
    @Inject(IAM_UNIT_OF_WORK)
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(input: DeactivateAdminUserInput) {
    assertHasPermissions(input.actor.permissions, ['users.deactivate']);

    return this.unitOfWork.run(async (tx) => {
      const existingRecord = await this.adminUserRepository.findById(input.userId, tx);

      if (!existingRecord) {
        throw new NotFoundException('Admin user not found');
      }

      const existingUser = AdminUserEntity.fromState(existingRecord);
      existingUser.ensureActiveTransitionAllowed(false);

      const updatedUser = await this.adminUserRepository.update({
        id: input.userId,
        isActive: false,
      }, tx);

      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'users.admin.deactivated',
        entityType: 'user',
        entityId: updatedUser.id,
        beforeData: existingRecord,
        afterData: updatedUser,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);

      return updatedUser;
    }, { userId: input.userId, authorization: { actorUserId: input.actor.sub, requiredPermissions: ['users.deactivate'] }, protection: { operation: 'users.admin.deactivated', entityType: 'user', entityId: input.userId, userId: input.userId, selfDeactivate: input.actor.sub === input.userId, ipAddress: input.ipAddress, userAgent: input.userAgent } });
  }
}
