import { Inject, Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepository,
} from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import { StockMovementEntity } from 'src/modules/stock-movements/domain/entities/stock-movement.entity';

export interface ListStockMovementsInput {
  actor: CurrentUser;
  variantId?: string;
  warehouseId?: string;
  referenceType?: string;
  referenceId?: string;
  movementType?: StockMovementType;
}

@Injectable()
export class ListStockMovementsUseCase {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository: StockMovementRepository,
  ) {}

  async execute(input: ListStockMovementsInput) {
    assertHasPermissions(input.actor.permissions, ['inventory.read']);

    const movements = await this.stockMovementRepository.list({
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      movementType: input.movementType,
    });

    return movements.map((movement) =>
      StockMovementEntity.fromState(movement).toResponse(),
    );
  }
}
