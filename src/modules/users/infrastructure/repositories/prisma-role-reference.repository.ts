import type { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { RoleReferenceRepository } from 'src/modules/users/domain/repositories/role-reference.repository';

@Injectable()
export class PrismaRoleReferenceRepository implements RoleReferenceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }
}
