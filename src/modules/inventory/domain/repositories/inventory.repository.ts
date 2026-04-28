import { Prisma } from '@prisma/client';
import { InventoryItemState } from 'src/modules/inventory/domain/entities/inventory-item.entity';

export type PrismaTransactionClient = Prisma.TransactionClient;

export interface InventoryLockTarget {
  variantId: string;
  warehouseId: string;
}

export interface InventoryAllocationCandidate {
  variantId: string;
  warehouseId: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  createdAt: Date;
}

export interface InventoryAdjustmentRecord {
  variantId: string;
  warehouseId: string;
  onHandQty: number;
  reservedQty: number;
}

export interface InventoryRepository {
  findByVariantAndWarehouse(
    variantId: string,
    warehouseId: string,
  ): Promise<InventoryItemState | null>;
  findAllocationCandidates(
    variantIds: string[],
  ): Promise<InventoryAllocationCandidate[]>;
  lockMany(
    tx: PrismaTransactionClient,
    targets: InventoryLockTarget[],
  ): Promise<InventoryItemState[]>;
  updateQuantities(
    tx: PrismaTransactionClient,
    variantId: string,
    warehouseId: string,
    data: {
      onHandQty?: number;
      reservedQty?: number;
    },
  ): Promise<InventoryItemState>;
  create(
    tx: PrismaTransactionClient,
    data: InventoryAdjustmentRecord,
  ): Promise<InventoryItemState>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
