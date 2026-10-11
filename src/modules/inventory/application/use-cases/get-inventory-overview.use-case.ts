import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

export interface OverviewRow {
  id: string;
  variantId: string;
  warehouseId: string;
  onHandQty: number;
  reservedQty: number;
  committedQty: number;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  costPrice: unknown;
  updatedAt: Date;
  variant: { sku: string; name: string; price: unknown; product: { name: string; brand?: { name: string } | null; category?: { name: string } | null } | null };
  warehouse: { code: string; name: string; isDefault: boolean; isActive: boolean };
}

export interface SerializedRow {
  id: string;
  product: string | null;
  brand: string | null;
  category: string | null;
  variantId: string;
  sku: string;
  variant: string;
  warehouseId: string;
  warehouseCode: string;
  warehouse: string;
  warehouseDefault: boolean;
  physicalStock: number;
  reservedStock: number;
  committedStock: number;
  availableStock: number;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  costPrice: number | null;
  inventoryValue: number | null;
  stockStatus: string;
  updatedAt: Date;
}

@Injectable()
export class GetInventoryOverviewUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(input: { actor: CurrentUser; search?: string }) {
    assertHasPermissions(input.actor.permissions, ['inventory.read']);
    const canReadCost = input.actor.permissions.includes('inventory.cost.read');
    const where = input.search?.trim()
      ? {
          OR: [
            { variant: { sku: { contains: input.search.trim(), mode: 'insensitive' as const } } },
            { variant: { name: { contains: input.search.trim(), mode: 'insensitive' as const } } },
            { warehouse: { name: { contains: input.search.trim(), mode: 'insensitive' as const } } },
          ],
        }
      : {};
    const rows = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: { include: { product: { include: { brand: true, category: true } } } },
        warehouse: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 250,
    });
    const mapped = rows.map((row) => this.serializeRow(row));
    return {
      summary: canReadCost ? this.summary(mapped) : { ...this.summary(mapped), missingCost: 'NO_PERMISSION', inventoryValue: 'NO_PERMISSION' },
      data: canReadCost ? mapped : mapped.map((row) => ({ ...row, costPrice: 'NO_PERMISSION', inventoryValue: 'NO_PERMISSION' })),
    };
  }

  private serializeRow(row: OverviewRow): SerializedRow {
    const available = row.onHandQty - row.reservedQty - row.committedQty;
    const cost = row.costPrice ? Number(row.costPrice) : null;
    return {
      id: row.id,
      product: row.variant.product?.name ?? row.variant.name,
      brand: row.variant.product?.brand?.name ?? null,
      category: row.variant.product?.category?.name ?? null,
      variantId: row.variantId,
      sku: row.variant.sku,
      variant: row.variant.name,
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouse.code,
      warehouse: row.warehouse.name,
      warehouseDefault: row.warehouse.isDefault,
      physicalStock: row.onHandQty,
      reservedStock: row.reservedQty,
      committedStock: row.committedQty,
      availableStock: available,
      minStock: row.minStock,
      maxStock: row.maxStock,
      reorderPoint: row.reorderPoint,
      reorderQty: row.reorderQty,
      costPrice: cost,
      inventoryValue: cost === null ? null : available * cost,
      stockStatus: available <= 0 ? 'out_of_stock' : row.minStock !== null && available <= row.minStock ? 'low_stock' : 'healthy',
      updatedAt: row.updatedAt,
    };
  }

  private summary(rows: SerializedRow[]) {
    return {
      skuCount: rows.length,
      physicalStock: rows.reduce((sum, row) => sum + row.physicalStock, 0),
      reservedStock: rows.reduce((sum, row) => sum + row.reservedStock, 0),
      committedStock: rows.reduce((sum, row) => sum + row.committedStock, 0),
      availableStock: rows.reduce((sum, row) => sum + row.availableStock, 0),
      lowStock: rows.filter((row) => row.stockStatus === 'low_stock').length,
      outOfStock: rows.filter((row) => row.stockStatus === 'out_of_stock').length,
      missingCost: rows.filter((row) => row.costPrice === null && row.availableStock > 0).length,
      inventoryValue: rows.reduce((sum, row) => sum + (row.inventoryValue ?? 0), 0),
    };
  }
}
