import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  ReplaceRolePermissionsInput,
  RolePermissionRepository,
} from 'src/modules/permissions/domain/repositories/role-permission.repository';

@Injectable()
export class PrismaRolePermissionRepository implements RolePermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceForRole(input: ReplaceRolePermissionsInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId: input.roleId },
      });

      if (input.permissionIds.length === 0) {
        return;
      }

      await tx.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({
          id: crypto.randomUUID(),
          roleId: input.roleId,
          permissionId,
        })),
      });
    });
  }

  async getMatrix() {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      roleId: role.id,
      roleName: role.name,
      roleSlug: role.slug,
      permissions: role.rolePermissions
        .map((entry) => entry.permission.slug)
        .sort((left, right) => left.localeCompare(right)),
    }));
  }
}
