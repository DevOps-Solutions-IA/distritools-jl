import { Inject, Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

export interface GetStockMovementsInput {
  variantId?: string;
  sku?: string;
  warehouseId?: string;
  movementType?: StockMovementType;
  referenceType?: string;
  referenceId?: string;
}

@Injectable()
export class GetStockMovementsUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(filters: GetStockMovementsInput) {
    const rows = await this.prisma.stockMovement.findMany({
      where: {
        variantId: filters.variantId,
        sku: filters.sku,
        warehouseId: filters.warehouseId,
        movementType: filters.movementType,
        referenceType: filters.referenceType,
        referenceId: filters.referenceId,
      },
      include: {
        variant: { include: { product: true } },
        warehouse: true,
        createdByUser: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.movementType,
        productId: row.productId,
        product: row.variant.product?.name ?? null,
        variantId: row.variantId,
        sku: row.sku ?? row.variant.sku,
        warehouseId: row.warehouseId,
        warehouse: row.warehouse.name,
        quantity: row.quantity,
        quantityDelta: row.quantityDelta,
        quantityBefore: row.quantityBefore,
        quantityAfter: row.quantityAfter,
        reasonCode: row.reasonCode,
        reasonText: row.reasonText ?? row.reason,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        orderId: row.orderId,
        source: row.source,
        actor: row.createdByUser
          ? { id: row.createdByUser.id, email: row.createdByUser.email, fullName: row.createdByUser.fullName }
          : null,
        createdAt: row.createdAt,
      })),
    };
  }
}
