import { IAM_UNIT_OF_WORK, IamUnitOfWork } from 'src/modules/users/application/ports/iam-unit-of-work.port';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { RoleEntity } from 'src/modules/roles/domain/entities/role.entity';
import {
  ROLE_REPOSITORY,
  RoleRepository,
} from 'src/modules/roles/domain/repositories/role.repository';
import {
  ROLE_USER_ASSIGNMENT_REPOSITORY,
  RoleUserAssignmentRepository,
} from 'src/modules/roles/domain/repositories/role-user-assignment.repository';
import { RoleIntegrityService } from 'src/modules/roles/domain/services/role-integrity.service';

export interface AssignRoleToUserInput {
  actor: CurrentUser;
  roleId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AssignRoleToUserUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(ROLE_USER_ASSIGNMENT_REPOSITORY)
    private readonly roleUserAssignmentRepository: RoleUserAssignmentRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(RoleIntegrityService)
    private readonly roleIntegrityService: RoleIntegrityService,
    @Inject(IAM_UNIT_OF_WORK)
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(input: AssignRoleToUserInput) {
    assertHasPermissions(input.actor.permissions, ['roles.assign']);

    return this.unitOfWork.run(async (tx) => {
      const [roleRecord, existingUser] = await Promise.all([
        this.roleRepository.findById(input.roleId, tx),
        this.roleUserAssignmentRepository.findUserById(input.userId, tx),
      ]);

      this.roleIntegrityService.ensureRoleExists(
        roleRecord ? RoleEntity.fromState(roleRecord) : null,
      );

      if (!existingUser) {
        throw new NotFoundException('Admin user not found');
      }

      const updatedUser = await this.roleUserAssignmentRepository.assignRole(
        input.userId,
        input.roleId,
        tx,
      );

      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'roles.assigned_to_user',
        entityType: 'user',
        entityId: updatedUser.id,
        beforeData: existingUser,
        afterData: updatedUser,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);

      return updatedUser;
    }, { userId: input.userId, authorization: { actorUserId: input.actor.sub, requiredPermissions: ['roles.assign'] }, protection: { operation: 'roles.assigned_to_user', entityType: 'user', entityId: input.userId, userId: input.userId, nextRoleId: input.roleId, ipAddress: input.ipAddress, userAgent: input.userAgent } });
  }
}
