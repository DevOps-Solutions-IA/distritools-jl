import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AdminUserRepository,
  CreateAdminUserRecord,
  UpdateAdminUserRecord,
} from 'src/modules/users/domain/repositories/admin-user.repository';

@Injectable()
export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
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

  async create(data: CreateAdminUserRecord) {
    const user = await this.prisma.user.create({
      data: {
        id: data.id,
        fullName: data.fullName,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone,
        roleId: data.roleId,
      },
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

  async update(data: UpdateAdminUserRecord) {
    const user = await this.prisma.user.update({
      where: { id: data.id },
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone,
        roleId: data.roleId,
        isActive: data.isActive,
      },
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
