import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

interface AlertRow {
  variantId: string;
  onHandQty: number;
  reservedQty: number;
  committedQty: number;
  minStock: number | null;
  reorderPoint: number | null;
  variant: { sku: string; name: string; product?: { name: string } | null };
  warehouse: { code: string; name: string };
}

@Injectable()
export class GetInventoryAlertsUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute() {
    const rows = await this.prisma.inventoryItem.findMany({
      include: { variant: { include: { product: true } }, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      data: rows
        .map((row) => {
          const available = row.onHandQty - row.reservedQty - row.committedQty;
          if (available <= 0) {
            return this.buildAlert(row, 'inventory.out_of_stock', 'Sin stock disponible', 'danger');
          }
          const threshold = row.reorderPoint ?? row.minStock;
          if (threshold !== null && threshold !== undefined && available <= threshold) {
            return this.buildAlert(row, 'inventory.low_stock', 'Stock bajo', 'warning');
          }
          if (row.reservedQty > Math.max(1, Math.floor(row.onHandQty * 0.7))) {
            return this.buildAlert(row, 'inventory.high_reserved_stock', 'Reserva alta frente al físico', 'warning');
          }
          if (row.minStock === null && row.reorderPoint === null) {
            return this.buildAlert(row, 'inventory.missing_minimum', 'Sin mínimo configurado', 'info');
          }
          return null;
        })
        .filter(Boolean),
    };
  }

  private buildAlert(row: AlertRow, code: string, message: string, severity: string) {
    return {
      code,
      severity,
      message,
      variantId: row.variantId,
      sku: row.variant.sku,
      product: row.variant.product?.name ?? row.variant.name,
      warehouseCode: row.warehouse.code,
      warehouse: row.warehouse.name,
      physicalStock: row.onHandQty,
      reservedStock: row.reservedQty,
      committedStock: row.committedQty,
      availableStock: row.onHandQty - row.reservedQty - row.committedQty,
    };
  }
}
