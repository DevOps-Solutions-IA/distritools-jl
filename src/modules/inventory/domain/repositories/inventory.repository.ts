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
  committedQty?: number;
  availableQty: number;
  createdAt: Date;
}

export interface InventoryAdjustmentRecord {
  variantId: string;
  warehouseId: string;
  onHandQty: number;
  reservedQty: number;
  committedQty?: number;
}

export interface InventoryRepository {
  withTransaction<T>(
    operation: (tx: PrismaTransactionClient) => Promise<T>,
  ): Promise<T>;
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
      committedQty?: number;
      minStock?: number | null;
      maxStock?: number | null;
      reorderPoint?: number | null;
      reorderQty?: number | null;
      costPrice?: unknown;
    },
  ): Promise<InventoryItemState>;
  create(
    tx: PrismaTransactionClient,
    data: InventoryAdjustmentRecord,
  ): Promise<InventoryItemState>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
