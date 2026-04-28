import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  PERMISSION_REPOSITORY,
  PermissionRepository,
} from 'src/modules/permissions/domain/repositories/permission.repository';
import {
  PERMISSION_ROLE_REFERENCE_REPOSITORY,
  PermissionRoleReferenceRepository,
} from 'src/modules/permissions/domain/repositories/permission-role-reference.repository';
import {
  ROLE_PERMISSION_REPOSITORY,
  RolePermissionRepository,
} from 'src/modules/permissions/domain/repositories/role-permission.repository';
import { PermissionMatrixService } from 'src/modules/permissions/domain/services/permission-matrix.service';

export interface AssignPermissionsToRoleInput {
  actor: CurrentUser;
  roleId: string;
  permissionSlugs: string[];
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AssignPermissionsToRoleUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: PermissionRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY)
    private readonly rolePermissionRepository: RolePermissionRepository,
    @Inject(PERMISSION_ROLE_REFERENCE_REPOSITORY)
    private readonly permissionRoleReferenceRepository: PermissionRoleReferenceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    private readonly permissionMatrixService: PermissionMatrixService,
  ) {}

  async execute(input: AssignPermissionsToRoleInput) {
    assertHasPermissions(input.actor.permissions, ['permissions.assign']);

    const normalizedPermissionSlugs = [
      ...new Set(input.permissionSlugs.map((slug) => slug.trim().toLowerCase())),
    ];
    const [role, permissions, beforeMatrix] = await Promise.all([
      this.permissionRoleReferenceRepository.findRoleById(input.roleId),
      this.permissionRepository.findBySlugs(normalizedPermissionSlugs),
      this.rolePermissionRepository.getMatrix(),
    ]);

    this.permissionMatrixService.ensureRoleExists(role);
    this.permissionMatrixService.ensurePermissionCatalogCompleteness(
      normalizedPermissionSlugs,
      permissions,
    );

    await this.rolePermissionRepository.replaceForRole({
      roleId: input.roleId,
      permissionIds: permissions.map((permission) => permission.id),
    });

    const afterMatrix = await this.rolePermissionRepository.getMatrix();

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'permissions.assigned_to_role',
      entityType: 'role',
      entityId: input.roleId,
      beforeData: beforeMatrix.find((entry) => entry.roleId === input.roleId),
      afterData: afterMatrix.find((entry) => entry.roleId === input.roleId),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return afterMatrix.find((entry) => entry.roleId === input.roleId) ?? {
      roleId: role.id,
      roleName: role.name,
      roleSlug: role.slug,
      permissions: [],
    };
  }
}
