import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreatePromotionRecord,
  PromotionRepository,
  UpdatePromotionRecord,
} from 'src/modules/promotions/domain/repositories/promotion.repository';

@Injectable()
export class PrismaPromotionRepository implements PromotionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private map(record: {
    id: string;
    productId: string | null;
    name: string;
    slug: string;
    description: string | null;
    type: 'percentage' | 'fixed_amount';
    scope: 'line' | 'cart';
    stackingMode: 'exclusive' | 'stackable_same_scope' | 'stackable_cross_scope';
    priority: number;
    value: { toFixed: (digits: number) => string };
    minSubtotal: { toFixed: (digits: number) => string } | null;
    minQuantity: number | null;
    targetType: 'all' | 'product' | 'variant' | 'category' | 'brand';
    targetIds: unknown;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...record,
      value: record.value.toFixed(2),
      minSubtotal: record.minSubtotal?.toFixed(2) ?? null,
    };
  }

  async create(data: CreatePromotionRecord) {
    const created = await this.prisma.promotion.create({
      data: {
        ...data,
        targetIds: data.targetIds as unknown as Prisma.InputJsonValue,
      },
    });

    return this.map(created);
  }

  async update(data: UpdatePromotionRecord) {
    const { id, ...update } = data;
    const updateData: Record<string, unknown> = {
      ...update,
    };

    if (update.targetIds !== undefined) {
      updateData.targetIds = update.targetIds as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: updateData,
    });

    return this.map(updated);
  }

  async findById(id: string) {
    const record = await this.prisma.promotion.findUnique({
      where: { id },
    });

    return record ? this.map(record) : null;
  }

  async findBySlug(slug: string) {
    const record = await this.prisma.promotion.findUnique({
      where: { slug },
    });

    return record ? this.map(record) : null;
  }

  async list() {
    const records = await this.prisma.promotion.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map((record) => this.map(record));
  }

  async listActive(at: Date) {
    const records = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: at } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: at } }] }],
      },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    });

    return records.map((record) => this.map(record));
  }
}
