import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PermissionRoleReferenceRepository } from 'src/modules/permissions/domain/repositories/permission-role-reference.repository';

@Injectable()
export class PrismaPermissionRoleReferenceRepository
  implements PermissionRoleReferenceRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findRoleById(roleId: string) {
    return this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }
}
