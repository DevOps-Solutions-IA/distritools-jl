import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class GetInventoryValuationUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute() {
    const rows = await this.prisma.inventoryItem.findMany({
      include: { variant: { include: { product: { include: { category: true } } } }, warehouse: true },
    });
    let total = 0;
    const byWarehouse = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const items = rows.map((row) => {
      const available = row.onHandQty - row.reservedQty - row.committedQty;
      const cost = row.costPrice ? Number(row.costPrice) : null;
      const value = cost === null ? null : available * cost;
      if (value !== null) {
        total += value;
        byWarehouse.set(row.warehouse.name, (byWarehouse.get(row.warehouse.name) ?? 0) + value);
        byCategory.set(
          row.variant.product?.category?.name ?? 'Sin categoría',
          (byCategory.get(row.variant.product?.category?.name ?? 'Sin categoría') ?? 0) + value,
        );
      }
      return {
        variantId: row.variantId,
        sku: row.variant.sku,
        product: row.variant.product?.name ?? row.variant.name,
        warehouse: row.warehouse.name,
        availableStock: available,
        costPrice: cost,
        inventoryValue: value,
        valuationStatus: cost === null ? 'missing_cost' : 'valued',
      };
    });
    return {
      totalValue: total,
      byWarehouse: Object.fromEntries(byWarehouse),
      byCategory: Object.fromEntries(byCategory),
      missingCost: items.filter((item) => item.valuationStatus === 'missing_cost' && item.availableStock > 0).length,
      data: items,
    };
  }
}
