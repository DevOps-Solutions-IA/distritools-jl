import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  InventoryAllocationCandidate,
  InventoryAdjustmentRecord,
  InventoryLockTarget,
  InventoryRepository,
  PrismaTransactionClient,
} from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByVariantAndWarehouse(variantId: string, warehouseId: string) {
    return this.prisma.inventoryItem.findUnique({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
    });
  }

  async findAllocationCandidates(
    variantIds: string[],
  ): Promise<InventoryAllocationCandidate[]> {
    if (!variantIds.length) {
      return [];
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: {
        variantId: {
          in: variantIds,
        },
        warehouse: {
          isActive: true,
        },
      },
      select: {
        variantId: true,
        warehouseId: true,
        onHandQty: true,
        reservedQty: true,
        createdAt: true,
      },
    });

    return inventoryItems
      .map((item) => ({
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        onHandQty: item.onHandQty,
        reservedQty: item.reservedQty,
        availableQty: item.onHandQty - item.reservedQty,
        createdAt: item.createdAt,
      }))
      .filter((item) => item.availableQty > 0)
      .sort((left, right) => {
        const variantComparison = left.variantId.localeCompare(right.variantId);
        if (variantComparison !== 0) {
          return variantComparison;
        }

        if (left.availableQty !== right.availableQty) {
          return right.availableQty - left.availableQty;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });
  }

  async lockMany(
    tx: PrismaTransactionClient,
    targets: InventoryLockTarget[],
  ) {
    const uniqueTargets = [...new Map(
      targets.map((target) => [`${target.variantId}:${target.warehouseId}`, target]),
    ).values()].sort((left, right) =>
      `${left.variantId}:${left.warehouseId}`.localeCompare(
        `${right.variantId}:${right.warehouseId}`,
      ),
    );

    const rows = [];

    for (const target of uniqueTargets) {
      const queryResult = (await tx.$queryRaw(Prisma.sql`
        SELECT id, variant_id, warehouse_id, on_hand_qty, reserved_qty, created_at, updated_at
        FROM inventory_items
        WHERE variant_id = ${target.variantId}::uuid
          AND warehouse_id = ${target.warehouseId}::uuid
        FOR UPDATE
      `)) as Array<{
        id: string;
        variant_id: string;
        warehouse_id: string;
        on_hand_qty: number;
        reserved_qty: number;
        created_at: Date;
        updated_at: Date;
      }>;
      const [lockedRow] = queryResult;

      if (lockedRow) {
        rows.push({
          id: lockedRow.id,
          variantId: lockedRow.variant_id,
          warehouseId: lockedRow.warehouse_id,
          onHandQty: Number(lockedRow.on_hand_qty),
          reservedQty: Number(lockedRow.reserved_qty),
          createdAt: lockedRow.created_at,
          updatedAt: lockedRow.updated_at,
        });
      }
    }

    return rows;
  }

  async updateQuantities(
    tx: PrismaTransactionClient,
    variantId: string,
    warehouseId: string,
    data: {
      onHandQty?: number;
      reservedQty?: number;
    },
  ) {
    const updated = await tx.inventoryItem.update({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
      data: {
        onHandQty: data.onHandQty,
        reservedQty: data.reservedQty,
      },
    });

    return {
      id: updated.id,
      variantId: updated.variantId,
      warehouseId: updated.warehouseId,
      onHandQty: updated.onHandQty,
      reservedQty: updated.reservedQty,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async create(tx: PrismaTransactionClient, data: InventoryAdjustmentRecord) {
    const created = await tx.inventoryItem.create({
      data: {
        id: uuidv7(),
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        onHandQty: data.onHandQty,
        reservedQty: data.reservedQty,
      },
    });

    return {
      id: created.id,
      variantId: created.variantId,
      warehouseId: created.warehouseId,
      onHandQty: created.onHandQty,
      reservedQty: created.reservedQty,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }
}
