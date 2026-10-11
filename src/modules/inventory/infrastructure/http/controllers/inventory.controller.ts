import { InventoryReadQueryDto, UpdateInventoryCountLinesDto } from 'src/modules/inventory/infrastructure/http/dto/inventory-read-query.dto';
import { GetInventoryCountSessionsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-count-sessions.use-case';
import { GetInventoryImportsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-imports.use-case';
import {
  Body, Controller, Get, Headers, Inject, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { AdjustStockUseCase } from 'src/modules/inventory/application/use-cases/adjust-stock.use-case';
import { ApplyInventoryImportUseCase } from 'src/modules/inventory/application/use-cases/apply-inventory-import.use-case';
import { CloseInventoryCountSessionUseCase } from 'src/modules/inventory/application/use-cases/close-inventory-count-session.use-case';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
import { CreateInventoryCountSessionUseCase } from 'src/modules/inventory/application/use-cases/create-inventory-count-session.use-case';
import { DryRunInventoryImportUseCase } from 'src/modules/inventory/application/use-cases/dry-run-inventory-import.use-case';
import { ExportInventoryUseCase } from 'src/modules/inventory/application/use-cases/export-inventory.use-case';
import { GetInventoryAlertsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-alerts.use-case';
import { GetInventoryItemUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-item.use-case';
import { GetInventoryOverviewUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-overview.use-case';
import { GetInventoryValuationUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-valuation.use-case';
import { GetReservationsUseCase } from 'src/modules/inventory/application/use-cases/get-reservations.use-case';
import { GetStockMovementsUseCase } from 'src/modules/inventory/application/use-cases/get-stock-movements.use-case';
import { GetWarehousesUseCase } from 'src/modules/inventory/application/use-cases/get-warehouses.use-case';
import { ProcessReturnUseCase } from 'src/modules/inventory/application/use-cases/process-return.use-case';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import { UpdateCountSessionLinesUseCase } from 'src/modules/inventory/application/use-cases/update-count-session-lines.use-case';
import { UpdateInventorySettingsUseCase } from 'src/modules/inventory/application/use-cases/update-inventory-settings.use-case';
import { AdjustStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/adjust-stock.request.dto';
import { CommitStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/commit-stock.request.dto';
import { ReleaseStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/release-stock.request.dto';
import { ReserveStockRequestDto } from 'src/modules/inventory/infrastructure/http/dto/reserve-stock.request.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('admin/inventory')
export class InventoryController {
  constructor(
    @Inject(GetInventoryCountSessionsUseCase) private readonly countReads: GetInventoryCountSessionsUseCase,
    @Inject(GetInventoryImportsUseCase) private readonly importReads: GetInventoryImportsUseCase,
    @Inject(ReserveStockUseCase) private readonly reserveStockUseCase: ReserveStockUseCase,
    @Inject(ReleaseStockUseCase) private readonly releaseStockUseCase: ReleaseStockUseCase,
    @Inject(CommitStockUseCase) private readonly commitStockUseCase: CommitStockUseCase,
    @Inject(AdjustStockUseCase) private readonly adjustStockUseCase: AdjustStockUseCase,
    @Inject(GetInventoryItemUseCase) private readonly getInventoryItemUseCase: GetInventoryItemUseCase,
    @Inject(GetInventoryOverviewUseCase) private readonly getInventoryOverviewUseCase: GetInventoryOverviewUseCase,
    @Inject(GetWarehousesUseCase) private readonly getWarehousesUseCase: GetWarehousesUseCase,
    @Inject(GetStockMovementsUseCase) private readonly getStockMovementsUseCase: GetStockMovementsUseCase,
    @Inject(GetInventoryAlertsUseCase) private readonly getInventoryAlertsUseCase: GetInventoryAlertsUseCase,
    @Inject(GetInventoryValuationUseCase) private readonly getInventoryValuationUseCase: GetInventoryValuationUseCase,
    @Inject(GetReservationsUseCase) private readonly getReservationsUseCase: GetReservationsUseCase,
    @Inject(UpdateInventorySettingsUseCase) private readonly updateInventorySettingsUseCase: UpdateInventorySettingsUseCase,
    @Inject(ProcessReturnUseCase) private readonly processReturnUseCase: ProcessReturnUseCase,
    @Inject(CreateInventoryCountSessionUseCase) private readonly createInventoryCountSessionUseCase: CreateInventoryCountSessionUseCase,
    @Inject(UpdateCountSessionLinesUseCase) private readonly updateCountSessionLinesUseCase: UpdateCountSessionLinesUseCase,
    @Inject(CloseInventoryCountSessionUseCase) private readonly closeInventoryCountSessionUseCase: CloseInventoryCountSessionUseCase,
    @Inject(DryRunInventoryImportUseCase) private readonly dryRunInventoryImportUseCase: DryRunInventoryImportUseCase,
    @Inject(ApplyInventoryImportUseCase) private readonly applyInventoryImportUseCase: ApplyInventoryImportUseCase,
    @Inject(ExportInventoryUseCase) private readonly exportInventoryUseCase: ExportInventoryUseCase,
  ) {}

  @Permissions('inventory.read')
  @Get('overview')
  async overview(@CurrentUserDecorator() actor: CurrentUser, @Query('search') search?: string) {
    return this.getInventoryOverviewUseCase.execute({ actor, search });
  }

  @Permissions('inventory.read')
  @Get('warehouses')
  async warehouses() { return this.getWarehousesUseCase.execute(); }

  @Permissions('inventory.read')
  @Get('history')
  async history(
    @Query('variantId') v?: string, @Query('sku') s?: string,
    @Query('warehouseId') w?: string, @Query('movementType') m?: string,
    @Query('referenceType') rt?: string, @Query('referenceId') ri?: string,
  ) {
    return this.getStockMovementsUseCase.execute({
      variantId: v, sku: s, warehouseId: w,
      movementType: m as StockMovementType | undefined,
      referenceType: rt, referenceId: ri,
    });
  }

  @Permissions('inventory.alerts.read')
  @Get('alerts')
  async alerts() { return this.getInventoryAlertsUseCase.execute(); }

  @Permissions('inventory.cost.read')
  @Get('valuation')
  async valuation() { return this.getInventoryValuationUseCase.execute(); }

  @Permissions('inventory.read')
  @Get('reservations')
  async reservations() { return this.getReservationsUseCase.execute(); }

  @Permissions('inventory.count.read')
  @Get('count-sessions')
  listCountSessions(@CurrentUserDecorator() actor: CurrentUser, @Query() query: InventoryReadQueryDto) {
    return this.countReads.list(actor, query);
  }

  @Permissions('inventory.count.read')
  @Get('count-sessions/:sessionId')
  getCountSession(@CurrentUserDecorator() actor: CurrentUser, @Param('sessionId', new ParseUUIDPipe()) id: string) {
    return this.countReads.get(actor, id);
  }

  @Permissions('inventory.import')
  @Get('imports')
  listImports(@CurrentUserDecorator() actor: CurrentUser, @Query() query: InventoryReadQueryDto) {
    return this.importReads.list(actor, query);
  }

  @Permissions('inventory.import')
  @Get('imports/:batchId')
  getImport(@CurrentUserDecorator() actor: CurrentUser, @Param('batchId', new ParseUUIDPipe()) id: string) {
    return this.importReads.get(actor, id);
  }

  @Permissions('inventory.read')
  @Get(':variantId/:warehouseId')
  getItem(@Param('variantId') variantId: string, @Param('warehouseId') warehouseId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getInventoryItemUseCase.execute({ actor, variantId, warehouseId });
  }

  @Permissions('inventory.reserve')
  @Post('reserve')
  reserve(@Body() body: ReserveStockRequestDto, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.reserveStockUseCase.execute({ actor, ...body, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.release')
  @Post('release')
  release(@Body() body: ReleaseStockRequestDto, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.releaseStockUseCase.execute({ actor, ...body, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.commit')
  @Post('commit')
  commit(@Body() body: CommitStockRequestDto, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.commitStockUseCase.execute({ actor, ...body, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.adjust')
  @Patch('adjust')
  adjust(@Body() body: AdjustStockRequestDto, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.adjustStockUseCase.execute({ actor, ...body, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.settings.write', 'inventory.cost.write')
  @Patch('settings/:variantId/:warehouseId')
  async updateSettings(@Param('variantId') v: string, @Param('warehouseId') w: string, @Body() body: Record<string, unknown>, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.updateInventorySettingsUseCase.execute({ variantId: v, warehouseId: w, body, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.return')
  @Post('returns')
  async returnStock(@Body() body: Record<string, unknown>, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.processReturnUseCase.execute({ body, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.count.write')
  @Post('count-sessions')
  async createCountSession(@Body() body: Record<string, unknown>, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.createInventoryCountSessionUseCase.execute({ body, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.count.write')
  @Patch('count-sessions/:sessionId/lines')
  async updateCountLines(@Param('sessionId', new ParseUUIDPipe()) sessionId: string, @Body() body: UpdateInventoryCountLinesDto, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.updateCountSessionLinesUseCase.execute(sessionId, body, actor, ip, ua);
  }

  @Permissions('inventory.count.close')
  @Post('count-sessions/:sessionId/close')
  async closeCountSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.closeInventoryCountSessionUseCase.execute({ sessionId, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.import')
  @Post('imports/dry-run')
  async importDryRun(@Body() body: Record<string, unknown>, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.dryRunInventoryImportUseCase.execute({ body, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.import')
  @Post('imports/:batchId/apply')
  async applyImport(@Param('batchId') batchId: string, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.applyInventoryImportUseCase.execute({ batchId, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('inventory.export')
  @Get('export')
  async exportInventory(@CurrentUserDecorator() actor: CurrentUser, @Res() res: Response) {
    const csv = await this.exportInventoryUseCase.execute({ actor });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-export.csv"');
    return res.send(csv);
  }
}
