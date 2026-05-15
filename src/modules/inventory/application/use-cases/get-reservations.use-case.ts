import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class GetReservationsUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute() {
    const rows = await this.prisma.inventoryItem.findMany({
      where: { OR: [{ reservedQty: { gt: 0 } }, { committedQty: { gt: 0 } }] },
      include: { variant: { include: { product: true } }, warehouse: true },
      orderBy: [{ reservedQty: 'desc' }, { committedQty: 'desc' }],
    });
    return {
      data: rows.map((row) => ({
        variantId: row.variantId,
        sku: row.variant.sku,
        product: row.variant.product?.name ?? row.variant.name,
        warehouseId: row.warehouseId,
        warehouse: row.warehouse.name,
        physicalStock: row.onHandQty,
        reservedStock: row.reservedQty,
        committedStock: row.committedQty,
        availableStock: row.onHandQty - row.reservedQty - row.committedQty,
      })),
    };
  }
}
