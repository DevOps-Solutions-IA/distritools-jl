import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItemEntity } from 'src/modules/inventory/domain/entities/inventory-item.entity';
import {
  InventoryVariantReference,
  InventoryWarehouseReference,
} from 'src/modules/inventory/domain/repositories/inventory-reference.repository';
import { StockMovementEntity } from 'src/modules/stock-movements/domain/entities/stock-movement.entity';

@Injectable()
export class InventoryPolicyService {
  ensureVariantExists(
    variant: InventoryVariantReference | null,
  ): asserts variant is InventoryVariantReference {
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (!variant.isActive) {
      throw new ConflictException('Variant is inactive');
    }
  }

  ensureWarehouseExists(
    warehouse: InventoryWarehouseReference | null,
  ): asserts warehouse is InventoryWarehouseReference {
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    if (!warehouse.isActive) {
      throw new ConflictException('Warehouse is inactive');
    }
  }

  ensureInventoryExists(
    item: InventoryItemEntity | null,
    variantId: string,
    warehouseId: string,
  ): asserts item is InventoryItemEntity {
    if (!item) {
      throw new NotFoundException(
        `Inventory item not found for variant ${variantId} and warehouse ${warehouseId}`,
      );
    }
  }

  ensureIdempotentMovementQuantity(
    existingMovement: StockMovementEntity,
    expectedQuantity: number,
  ): void {
    if (existingMovement.toResponse().quantity !== expectedQuantity) {
      throw new ConflictException(
        'Existing stock movement conflicts with requested quantity',
      );
    }
  }
}
