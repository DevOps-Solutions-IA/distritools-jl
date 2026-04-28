import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateStockMovementRecord,
  FindStockMovementRecord,
  ListStockMovementsFilters,
  StockMovementRepository,
} from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import {
  PrismaTransactionClient,
} from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaStockMovementRepository implements StockMovementRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByUniqueReference(
    tx: PrismaTransactionClient,
    where: FindStockMovementRecord,
  ) {
    return tx.stockMovement.findUnique({
      where: {
        movementType_variantId_warehouseId_referenceType_referenceId: {
          movementType: where.movementType,
          variantId: where.variantId,
          warehouseId: where.warehouseId,
          referenceType: where.referenceType,
          referenceId: where.referenceId,
        },
      },
    });
  }

  async create(
    tx: PrismaTransactionClient,
    data: CreateStockMovementRecord,
  ) {
    return tx.stockMovement.create({
      data: {
        id: data.id,
        movementType: data.movementType,
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        reason: data.reason,
        createdByUserId: data.createdByUserId,
      },
    });
  }

  async list(filters: ListStockMovementsFilters) {
    return this.prisma.stockMovement.findMany({
      where: {
        variantId: filters.variantId,
        warehouseId: filters.warehouseId,
        referenceType: filters.referenceType,
        referenceId: filters.referenceId,
        movementType: filters.movementType,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
