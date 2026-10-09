import { Inject, Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { InventoryItemEntity } from 'src/modules/inventory/domain/entities/inventory-item.entity';
import {
  INVENTORY_REPOSITORY,
  InventoryLockTarget,
  InventoryRepository,
  PrismaTransactionClient,
} from 'src/modules/inventory/domain/repositories/inventory.repository';
import { InventoryPolicyService } from 'src/modules/inventory/domain/services/inventory-policy.service';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepository,
} from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import { StockMovementEntity } from 'src/modules/stock-movements/domain/entities/stock-movement.entity';
import { normalizeStockLines } from 'src/modules/inventory/application/use-cases/normalize-stock-lines';

export interface ReleaseStockLineInput {
  variantId: string;
  warehouseId: string;
  quantity: number;
}

export interface ReleaseStockInput {
  actor?: CurrentUser;
  referenceType: string;
  referenceId: string;
  reason?: string;
  lines: ReleaseStockLineInput[];
  ipAddress?: string;
  userAgent?: string;
  tx?: PrismaTransactionClient;
}

@Injectable()
export class ReleaseStockUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository: StockMovementRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(InventoryPolicyService)
    private readonly inventoryPolicyService: InventoryPolicyService,
  ) {}

  async execute(input: ReleaseStockInput) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['inventory.release']);
    }

    const sortedLines = normalizeStockLines(input.lines);

    const executor = async (tx: PrismaTransactionClient) => {
      const lockedItems = await this.inventoryRepository.lockMany(
        tx,
        sortedLines.map<InventoryLockTarget>((line) => ({
          variantId: line.variantId,
          warehouseId: line.warehouseId,
        })),
      );
      const lockedMap = new Map(
        lockedItems.map((item) => [`${item.variantId}:${item.warehouseId}`, item]),
      );
      const movements = [];

      for (const line of sortedLines) {
        const inventoryRecord = lockedMap.get(
          `${line.variantId}:${line.warehouseId}`,
        );
        const inventoryEntity = inventoryRecord
          ? InventoryItemEntity.fromState(inventoryRecord)
          : null;

        this.inventoryPolicyService.ensureInventoryExists(
          inventoryEntity,
          line.variantId,
          line.warehouseId,
        );
        inventoryEntity.ensureValidQuantity(line.quantity);

        const existingMovement =
          await this.stockMovementRepository.findByUniqueReference(tx, {
            movementType: StockMovementType.release,
            variantId: line.variantId,
            warehouseId: line.warehouseId,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
          });

        if (existingMovement) {
          this.inventoryPolicyService.ensureIdempotentMovementQuantity(
            StockMovementEntity.fromState(existingMovement),
            line.quantity,
          );
          movements.push(existingMovement);
          continue;
        }

        inventoryEntity.ensureCanRelease(line.quantity);

        const updatedItem = await this.inventoryRepository.updateQuantities(
          tx,
          line.variantId,
          line.warehouseId,
          {
            reservedQty: inventoryEntity.reservedQty - line.quantity,
          },
        );

        lockedMap.set(`${line.variantId}:${line.warehouseId}`, updatedItem);

        const movement = await this.stockMovementRepository.create(tx, {
          id: uuidv7(),
          movementType: StockMovementType.release,
          variantId: line.variantId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          quantityDelta: 0,
          quantityBefore: inventoryEntity.onHandQty,
          quantityAfter: updatedItem.onHandQty,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          reasonCode: input.reason ?? 'RESERVATION_RELEASED',
          reasonText: input.reason ?? null,
          reason: input.reason ?? null,
          source: input.actor ? 'admin' : 'system',
          createdByUserId: input.actor?.sub ?? null,
        });

        movements.push(movement);
      }

      return {
        items: sortedLines.map((line) =>
          InventoryItemEntity.fromState(
            lockedMap.get(`${line.variantId}:${line.warehouseId}`)!,
          ).toResponse(),
        ),
        movements,
      };
    };

    const executeWithAudit = async (tx: PrismaTransactionClient) => {
      const result = await executor(tx);
      await this.auditRepository.write({
        actorUserId: input.actor?.sub,
        action: 'inventory.released',
        entityType: 'inventory_release',
        entityId: input.referenceId,
        afterData: result,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);
      return result;
    };

    return input.tx
      ? executeWithAudit(input.tx)
      : this.prisma.$transaction(executeWithAudit);
  }
}
