import type { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateRoleRecord,
  RoleRepository,
  UpdateRoleRecord,
} from 'src/modules/roles/domain/repositories/role.repository';

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).role.findUnique({ where: { id } });
  }

  async findBySlug(slug: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).role.findUnique({ where: { slug } });
  }

  async create(data: CreateRoleRecord, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).role.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
      },
    });
  }

  async update(data: UpdateRoleRecord, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).role.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
      },
    });
  }
}
