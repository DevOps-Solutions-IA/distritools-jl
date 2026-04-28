import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { RoleReferenceRepository } from 'src/modules/users/domain/repositories/role-reference.repository';

@Injectable()
export class PrismaRoleReferenceRepository implements RoleReferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }
}
