import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const createData: Prisma.ProductUncheckedCreateInput = {
      id: data.id,
      brandId: data.brandId ?? null,
      categoryId: data.categoryId ?? null,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      metadata:
        data.metadata === null
          ? Prisma.JsonNull
          : data.metadata,
      isActive: data.isActive ?? true,
    };

    const created = await this.prisma.product.create({
      data: createData,
    });

    return (await this.mapById(created.id))!;
  }

  async update(data: UpdateProductRecord) {
    const { id, ...update } = data;
    const updateData: Prisma.ProductUncheckedUpdateInput = {
      ...update,
      metadata:
        update.metadata === null
          ? Prisma.JsonNull
          : update.metadata,
    };

    await this.prisma.product.update({
      where: { id },
      data: updateData,
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
