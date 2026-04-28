import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PermissionRepository } from 'src/modules/permissions/domain/repositories/permission.repository';

@Injectable()
export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlugs(slugs: string[]) {
    return this.prisma.permission.findMany({
      where: {
        slug: {
          in: slugs,
        },
      },
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
    });
  }

  async listAll() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
    });
  }
}
