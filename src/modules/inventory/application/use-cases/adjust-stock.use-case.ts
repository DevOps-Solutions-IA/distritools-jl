import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { InventoryItemEntity } from 'src/modules/inventory/domain/entities/inventory-item.entity';
import {
  INVENTORY_REFERENCE_REPOSITORY,
  InventoryReferenceRepository,
} from 'src/modules/inventory/domain/repositories/inventory-reference.repository';
import {
  INVENTORY_REPOSITORY,
  InventoryRepository,
} from 'src/modules/inventory/domain/repositories/inventory.repository';
import { InventoryPolicyService } from 'src/modules/inventory/domain/services/inventory-policy.service';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepository,
} from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import { StockMovementEntity } from 'src/modules/stock-movements/domain/entities/stock-movement.entity';

export interface AdjustStockInput {
  actor: CurrentUser;
  variantId: string;
  warehouseId: string;
  quantityDelta: number;
  reason: string;
  referenceId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdjustStockUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
    @Inject(INVENTORY_REFERENCE_REPOSITORY)
    private readonly inventoryReferenceRepository: InventoryReferenceRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository: StockMovementRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(InventoryPolicyService)
    private readonly inventoryPolicyService: InventoryPolicyService,
  ) {}

  async execute(input: AdjustStockInput) {
    assertHasPermissions(input.actor.permissions, ['inventory.adjust']);
    if (!input.reason?.trim()) {
      throw new BadRequestException('El motivo del ajuste de inventario es obligatorio.');
    }

    const [variant, warehouse] = await Promise.all([
      this.inventoryReferenceRepository.findVariantById(input.variantId),
      this.inventoryReferenceRepository.findWarehouseById(input.warehouseId),
    ]);

    this.inventoryPolicyService.ensureVariantExists(variant);
    this.inventoryPolicyService.ensureWarehouseExists(warehouse);

    const result = await this.inventoryRepository.withTransaction(async (tx) => {
      const lockedItems = await this.inventoryRepository.lockMany(tx, [
        {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
      ]);

      let inventoryRecord =
        lockedItems.find(
          (item) =>
            item.variantId === input.variantId &&
            item.warehouseId === input.warehouseId,
        ) ?? null;

      if (!inventoryRecord) {
        inventoryRecord = await this.inventoryRepository.create(tx, {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          onHandQty: 0,
          reservedQty: 0,
        });
      }

      const inventoryEntity = InventoryItemEntity.fromState(inventoryRecord);
      inventoryEntity.ensureAdjustmentResult(input.quantityDelta);
      const adjustmentMovementType = input.quantityDelta >= 0
        ? StockMovementType.manual_adjustment_in
        : StockMovementType.manual_adjustment_out;

      const existingMovement =
        await this.stockMovementRepository.findByUniqueReference(tx, {
          movementType: adjustmentMovementType,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          referenceType: 'adjustment',
          referenceId: input.referenceId,
        });

      if (existingMovement) {
        this.inventoryPolicyService.ensureIdempotentMovementQuantity(
          StockMovementEntity.fromState(existingMovement),
          Math.abs(input.quantityDelta),
        );

        return {
          item: inventoryEntity.toResponse(),
          movement: existingMovement,
        };
      }

      const updatedItem = await this.inventoryRepository.updateQuantities(
        tx,
        input.variantId,
        input.warehouseId,
        {
          onHandQty: inventoryEntity.onHandQty + input.quantityDelta,
        },
      );

      const movement = await this.stockMovementRepository.create(tx, {
        id: uuidv7(),
        movementType: adjustmentMovementType,
        productId: variant.productId,
        variantId: input.variantId,
        sku: variant.sku,
        warehouseId: input.warehouseId,
        quantity: Math.abs(input.quantityDelta),
        quantityDelta: input.quantityDelta,
        quantityBefore: inventoryEntity.onHandQty,
        quantityAfter: updatedItem.onHandQty,
        referenceType: 'adjustment',
        referenceId: input.referenceId,
        reasonCode: input.reason,
        reasonText: input.reason,
        reason: input.reason,
        source: 'admin',
        createdByUserId: input.actor.sub,
      });

      return {
        item: InventoryItemEntity.fromState(updatedItem).toResponse(),
        movement,
      };
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'inventory.adjusted',
      entityType: 'inventory_item',
      entityId: `${input.variantId}:${input.warehouseId}`,
      afterData: result,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return result;
  }
}
