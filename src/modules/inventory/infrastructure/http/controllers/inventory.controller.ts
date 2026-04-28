import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { AdjustStockUseCase } from 'src/modules/inventory/application/use-cases/adjust-stock.use-case';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import { GetInventoryItemUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-item.use-case';
import { AdjustStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/adjust-stock.request.dto';
import { CommitStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/commit-stock.request.dto';
import { ReleaseStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/release-stock.request.dto';
import { ReserveStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/reserve-stock.request.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('admin/inventory')
export class InventoryController {
  constructor(
    @Inject(ReserveStockUseCase)
    private readonly reserveStockUseCase: ReserveStockUseCase,
    @Inject(ReleaseStockUseCase)
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    @Inject(CommitStockUseCase)
    private readonly commitStockUseCase: CommitStockUseCase,
    @Inject(AdjustStockUseCase)
    private readonly adjustStockUseCase: AdjustStockUseCase,
    @Inject(GetInventoryItemUseCase)
    private readonly getInventoryItemUseCase: GetInventoryItemUseCase,
  ) {}

  @Permissions('inventory.read')
  @Get(':variantId/:warehouseId')
  getItem(
    @Param('variantId') variantId: string,
    @Param('warehouseId') warehouseId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.getInventoryItemUseCase.execute({ actor, variantId, warehouseId });
  }

  @Permissions('inventory.reserve')
  @Post('reserve')
  reserve(
    @Body() body: ReserveStockRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.reserveStockUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('inventory.release')
  @Post('release')
  release(
    @Body() body: ReleaseStockRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.releaseStockUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('inventory.commit')
  @Post('commit')
  commit(
    @Body() body: CommitStockRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.commitStockUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('inventory.adjust')
  @Patch('adjust')
  adjust(
    @Body() body: AdjustStockRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.adjustStockUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }
}
