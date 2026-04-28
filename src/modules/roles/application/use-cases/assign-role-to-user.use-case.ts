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
    private readonly roleIntegrityService: RoleIntegrityService,
  ) {}

  async execute(input: AssignRoleToUserInput) {
    assertHasPermissions(input.actor.permissions, ['roles.assign']);

    const [roleRecord, existingUser] = await Promise.all([
      this.roleRepository.findById(input.roleId),
      this.roleUserAssignmentRepository.findUserById(input.userId),
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
    });

    return updatedUser;
  }
}
