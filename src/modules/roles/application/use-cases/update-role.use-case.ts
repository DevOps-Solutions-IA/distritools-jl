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
import { RoleIntegrityService } from 'src/modules/roles/domain/services/role-integrity.service';

export interface UpdateRoleInput {
  actor: CurrentUser;
  roleId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(RoleIntegrityService)
    private readonly roleIntegrityService: RoleIntegrityService,
    @Inject(IAM_UNIT_OF_WORK)
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(input: UpdateRoleInput) {
    assertHasPermissions(input.actor.permissions, ['roles.update']);

    return this.unitOfWork.run(async (tx) => {
      const existingRoleRecord = await this.roleRepository.findById(input.roleId, tx);

      if (!existingRoleRecord) {
        throw new NotFoundException('Role not found');
      }

      const normalizedSlug = input.slug?.trim().toLowerCase();

      if (normalizedSlug) {
        const conflictingRole = await this.roleRepository.findBySlug(normalizedSlug, tx);
        this.roleIntegrityService.ensureSlugAvailable(
          conflictingRole ? RoleEntity.fromState(conflictingRole) : null,
          input.roleId,
        );
      }

      const updatedRole = await this.roleRepository.update({
        id: input.roleId,
        name: input.name?.trim(),
        slug: normalizedSlug,
        description:
          input.description === undefined ? undefined : input.description?.trim() || null,
      }, tx);

      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'roles.updated',
        entityType: 'role',
        entityId: updatedRole.id,
        beforeData: existingRoleRecord,
        afterData: updatedRole,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);

      return updatedRole;
    }, { roleId: input.roleId, authorization: { actorUserId: input.actor.sub, requiredPermissions: ['roles.update'] }, protection: { operation: 'roles.updated', entityType: 'role', entityId: input.roleId, roleId: input.roleId, nextSlug: input.slug?.trim().toLowerCase(), ipAddress: input.ipAddress, userAgent: input.userAgent } });
  }
}
