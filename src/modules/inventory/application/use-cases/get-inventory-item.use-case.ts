import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { InventoryItemEntity } from 'src/modules/inventory/domain/entities/inventory-item.entity';
import {
  INVENTORY_REPOSITORY,
  InventoryRepository,
} from 'src/modules/inventory/domain/repositories/inventory.repository';

export interface GetInventoryItemInput {
  actor: CurrentUser;
  variantId: string;
  warehouseId: string;
}

@Injectable()
export class GetInventoryItemUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async execute(input: GetInventoryItemInput) {
    assertHasPermissions(input.actor.permissions, ['inventory.read']);

    const record = await this.inventoryRepository.findByVariantAndWarehouse(
      input.variantId,
      input.warehouseId,
    );

    if (!record) {
      throw new NotFoundException('Inventory item not found');
    }

    return InventoryItemEntity.fromState(record).toResponse();
  }
}
