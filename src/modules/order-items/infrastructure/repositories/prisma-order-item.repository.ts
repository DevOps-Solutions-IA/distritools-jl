import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateOrderItemRecord,
  OrderItemRepository,
} from 'src/modules/order-items/domain/repositories/order-item.repository';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaOrderItemRepository implements OrderItemRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapItem(record: {
    id: string;
    orderId: string;
    variantId: string;
    warehouseId: string;
    variantNameSnapshot: string;
    skuSnapshot: string;
    unitPrice: { toFixed: (digits: number) => string };
    taxRate: { toFixed: (digits: number) => string };
    quantity: number;
    lineDiscountTotal: { toFixed: (digits: number) => string };
    appliedPromotionIds: unknown;
    lineSubtotal: { toFixed: (digits: number) => string };
    lineTaxTotal: { toFixed: (digits: number) => string };
    lineGrandTotal: { toFixed: (digits: number) => string };
    createdAt: Date;
  }) {
    return {
      id: record.id,
      orderId: record.orderId,
      variantId: record.variantId,
      warehouseId: record.warehouseId,
      variantNameSnapshot: record.variantNameSnapshot,
      skuSnapshot: record.skuSnapshot,
      unitPrice: record.unitPrice.toFixed(2),
      taxRate: record.taxRate.toFixed(2),
      quantity: record.quantity,
      lineDiscountTotal: record.lineDiscountTotal.toFixed(2),
      appliedPromotionIds: record.appliedPromotionIds,
      lineSubtotal: record.lineSubtotal.toFixed(2),
      lineTaxTotal: record.lineTaxTotal.toFixed(2),
      lineGrandTotal: record.lineGrandTotal.toFixed(2),
      createdAt: record.createdAt,
    };
  }

  async createMany(
    tx: PrismaTransactionClient,
    data: CreateOrderItemRecord[],
  ) {
    for (const row of data) {
      await tx.orderItem.create({
        data: {
          ...row,
          appliedPromotionIds: row.appliedPromotionIds as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const records = await tx.orderItem.findMany({
      where: {
        orderId: data[0]?.orderId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return records.map((record: (typeof records)[number]) =>
      this.mapItem(record as Parameters<typeof this.mapItem>[0]),
    );
  }

  async findByOrderId(orderId: string, tx?: PrismaTransactionClient) {
    const client = tx ?? this.prisma;
    const records = await client.orderItem.findMany({
      where: { orderId },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return records.map((record: (typeof records)[number]) =>
      this.mapItem(record as Parameters<typeof this.mapItem>[0]),
    );
  }
}
