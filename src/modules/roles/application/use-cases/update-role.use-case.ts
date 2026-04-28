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
    private readonly roleIntegrityService: RoleIntegrityService,
  ) {}

  async execute(input: UpdateRoleInput) {
    assertHasPermissions(input.actor.permissions, ['roles.update']);

    const existingRoleRecord = await this.roleRepository.findById(input.roleId);

    if (!existingRoleRecord) {
      throw new NotFoundException('Role not found');
    }

    const normalizedSlug = input.slug?.trim().toLowerCase();

    if (normalizedSlug) {
      const conflictingRole = await this.roleRepository.findBySlug(normalizedSlug);
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
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'roles.updated',
      entityType: 'role',
      entityId: updatedRole.id,
      beforeData: existingRoleRecord,
      afterData: updatedRole,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return updatedRole;
  }
}
