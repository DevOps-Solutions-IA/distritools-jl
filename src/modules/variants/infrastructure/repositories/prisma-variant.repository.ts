import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateVariantRecord,
  UpdateVariantRecord,
  VariantRepository,
} from 'src/modules/variants/domain/repositories/variant.repository';

@Injectable()
export class PrismaVariantRepository implements VariantRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async mapById(id: string) {
    const record = await this.prisma.variant.findUnique({
      where: { id },
      include: {
        product: {
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
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      ...record,
      price: record.price.toFixed(2),
      taxRate: record.taxRate.toFixed(2),
    };
  }

  async create(data: CreateVariantRecord) {
    const created = await this.prisma.variant.create({
      data,
    });

    return (await this.mapById(created.id))!;
  }

  async update(data: UpdateVariantRecord) {
    const { id, ...update } = data;
    await this.prisma.variant.update({
      where: { id },
      data: update,
    });

    return (await this.mapById(id))!;
  }

  async findById(id: string) {
    return this.mapById(id);
  }

  async findBySku(sku: string) {
    const record = await this.prisma.variant.findUnique({
      where: { sku },
      select: { id: true },
    });

    return record ? this.mapById(record.id) : null;
  }

  async list(options?: { onlyActive?: boolean; productId?: string }) {
    const variants = await this.prisma.variant.findMany({
      where: {
        ...(options?.onlyActive ? { isActive: true } : {}),
        ...(options?.productId ? { productId: options.productId } : {}),
      },
      include: {
        product: {
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
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return variants.map((variant) => ({
      ...variant,
      price: variant.price.toFixed(2),
      taxRate: variant.taxRate.toFixed(2),
    }));
  }
}
