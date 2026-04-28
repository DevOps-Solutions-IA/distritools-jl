import {
  PrismaTransactionClient,
} from 'src/modules/inventory/domain/repositories/inventory.repository';
import { StockMovementState } from 'src/modules/stock-movements/domain/entities/stock-movement.entity';
import { StockMovementType } from '@prisma/client';

export interface CreateStockMovementRecord {
  id: string;
  movementType: StockMovementType;
  variantId: string;
  warehouseId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  reason?: string | null;
  createdByUserId?: string | null;
}

export interface FindStockMovementRecord {
  movementType: StockMovementType;
  variantId: string;
  warehouseId: string;
  referenceType: string;
  referenceId: string;
}

export interface ListStockMovementsFilters {
  variantId?: string;
  warehouseId?: string;
  referenceType?: string;
  referenceId?: string;
  movementType?: StockMovementType;
}

export interface StockMovementRepository {
  findByUniqueReference(
    tx: PrismaTransactionClient,
    where: FindStockMovementRecord,
  ): Promise<StockMovementState | null>;
  create(
    tx: PrismaTransactionClient,
    data: CreateStockMovementRecord,
  ): Promise<StockMovementState>;
  list(filters: ListStockMovementsFilters): Promise<StockMovementState[]>;
}

export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');
