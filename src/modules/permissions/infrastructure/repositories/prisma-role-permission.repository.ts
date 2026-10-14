import type { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  ReplaceRolePermissionsInput,
  RolePermissionRepository,
} from 'src/modules/permissions/domain/repositories/role-permission.repository';

@Injectable()
export class PrismaRolePermissionRepository implements RolePermissionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceForRole(input: ReplaceRolePermissionsInput, tx?: Prisma.TransactionClient): Promise<void> {
    const replace = async (client: Prisma.TransactionClient) => {
      await client.rolePermission.deleteMany({
        where: { roleId: input.roleId },
      });

      if (input.permissionIds.length === 0) {
        return;
      }

      await client.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({
          id: crypto.randomUUID(),
          roleId: input.roleId,
          permissionId,
        })),
      });
    };
    if (tx) await replace(tx);
    else await this.prisma.$transaction(replace);
  }

  async getMatrix(tx?: Prisma.TransactionClient) {
    const roles = await (tx ?? this.prisma).role.findMany({
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
