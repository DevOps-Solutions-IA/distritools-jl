import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CategoryRepository,
  CreateCategoryRecord,
  UpdateCategoryRecord,
} from 'src/modules/categories/domain/repositories/category.repository';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateCategoryRecord) {
    return this.prisma.category.create({
      data,
    });
  }

  async update(data: UpdateCategoryRecord) {
    const { id, ...update } = data;

    return this.prisma.category.update({
      where: { id },
      data: update,
    });
  }

  async findById(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
    });
  }

  async list(options?: { onlyActive?: boolean }) {
    return this.prisma.category.findMany({
      where: options?.onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
