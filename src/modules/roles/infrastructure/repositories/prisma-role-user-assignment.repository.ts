import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { RoleUserAssignmentRepository } from 'src/modules/roles/domain/repositories/role-user-assignment.repository';

@Injectable()
export class PrismaRoleUserAssignmentRepository
  implements RoleUserAssignmentRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      roleName: user.role.name,
      roleSlug: user.role.slug,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async assignRole(userId: string, roleId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      roleName: user.role.name,
      roleSlug: user.role.slug,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
