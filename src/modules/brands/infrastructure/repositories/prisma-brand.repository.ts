import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  BrandRepository,
  CreateBrandRecord,
  UpdateBrandRecord,
} from 'src/modules/brands/domain/repositories/brand.repository';

@Injectable()
export class PrismaBrandRepository implements BrandRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateBrandRecord) {
    return this.prisma.brand.create({
      data,
    });
  }

  async update(data: UpdateBrandRecord) {
    const { id, ...update } = data;

    return this.prisma.brand.update({
      where: { id },
      data: update,
    });
  }

  async findById(id: string) {
    return this.prisma.brand.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.brand.findUnique({
      where: { slug },
    });
  }

  async list(options?: { onlyActive?: boolean }) {
    return this.prisma.brand.findMany({
      where: options?.onlyActive ? { isActive: true } : undefined,
      orderBy: [{ name: 'asc' }],
    });
  }
}
