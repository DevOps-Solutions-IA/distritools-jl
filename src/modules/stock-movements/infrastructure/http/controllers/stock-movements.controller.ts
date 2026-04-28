import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { ListStockMovementsUseCase } from 'src/modules/stock-movements/application/use-cases/list-stock-movements.use-case';

@ApiTags('stock-movements')
@ApiBearerAuth()
@Controller('admin/inventory/movements')
export class StockMovementsController {
  constructor(
    @Inject(ListStockMovementsUseCase)
    private readonly listStockMovementsUseCase: ListStockMovementsUseCase,
  ) {}

  @Permissions('inventory.read')
  @Get()
  list(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('variantId') variantId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('referenceType') referenceType?: string,
    @Query('referenceId') referenceId?: string,
    @Query('movementType') movementType?: StockMovementType,
  ) {
    return this.listStockMovementsUseCase.execute({
      actor,
      variantId,
      warehouseId,
      referenceType,
      referenceId,
      movementType,
    });
  }
}
