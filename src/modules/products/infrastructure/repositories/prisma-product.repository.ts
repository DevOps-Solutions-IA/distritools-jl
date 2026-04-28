import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateProductRecord,
  ProductRepository,
  UpdateProductRecord,
} from 'src/modules/products/domain/repositories/product.repository';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async mapById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async create(data: CreateProductRecord) {
    const created = await this.prisma.product.create({
      data,
    });

    return (await this.mapById(created.id))!;
  }

  async update(data: UpdateProductRecord) {
    const { id, ...update } = data;
    await this.prisma.product.update({
      where: { id },
      data: update,
    });

    return (await this.mapById(id))!;
  }

  async findById(id: string) {
    return this.mapById(id);
  }

  async findBySlug(slug: string) {
    const record = await this.prisma.product.findUnique({
      where: { slug },
    });

    return record ? this.mapById(record.id) : null;
  }

  async list(options?: { onlyActive?: boolean; brandId?: string; categoryId?: string }) {
    return this.prisma.product.findMany({
      where: {
        ...(options?.onlyActive ? { isActive: true } : {}),
        ...(options?.brandId ? { brandId: options.brandId } : {}),
        ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }
}
