import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import type { Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { AdjustStockUseCase } from 'src/modules/inventory/application/use-cases/adjust-stock.use-case';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import { GetInventoryAlertsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-alerts.use-case';
import { GetInventoryItemUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-item.use-case';
import { GetInventoryOverviewUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-overview.use-case';
import { GetInventoryValuationUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-valuation.use-case';
import { GetReservationsUseCase } from 'src/modules/inventory/application/use-cases/get-reservations.use-case';
import { GetStockMovementsUseCase } from 'src/modules/inventory/application/use-cases/get-stock-movements.use-case';
import { GetWarehousesUseCase } from 'src/modules/inventory/application/use-cases/get-warehouses.use-case';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
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
    @Inject(GetInventoryOverviewUseCase)
    private readonly getInventoryOverviewUseCase: GetInventoryOverviewUseCase,
    @Inject(GetWarehousesUseCase)
    private readonly getWarehousesUseCase: GetWarehousesUseCase,
    @Inject(GetStockMovementsUseCase)
    private readonly getStockMovementsUseCase: GetStockMovementsUseCase,
    @Inject(GetInventoryAlertsUseCase)
    private readonly getInventoryAlertsUseCase: GetInventoryAlertsUseCase,
    @Inject(GetInventoryValuationUseCase)
    private readonly getInventoryValuationUseCase: GetInventoryValuationUseCase,
    @Inject(GetReservationsUseCase)
    private readonly getReservationsUseCase: GetReservationsUseCase,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  @Permissions('inventory.read')
  @Get('overview')
  async overview(@Query('search') search?: string) {
    return this.getInventoryOverviewUseCase.execute({ search });
  }

  @Permissions('inventory.read')
  @Get('warehouses')
  async warehouses() {
    return this.getWarehousesUseCase.execute();
  }

  @Permissions('inventory.read')
  @Get('history')
  async history(
    @Query('variantId') variantId?: string,
    @Query('sku') sku?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('movementType') movementType?: string,
    @Query('referenceType') referenceType?: string,
    @Query('referenceId') referenceId?: string,
  ) {
    return this.getStockMovementsUseCase.execute({
      variantId, sku, warehouseId,
      movementType: movementType as StockMovementType | undefined,
      referenceType, referenceId,
    });
  }

  @Permissions('inventory.alerts.read')
  @Get('alerts')
  async alerts() {
    return this.getInventoryAlertsUseCase.execute();
  }

  @Permissions('inventory.cost.read')
  @Get('valuation')
  async valuation() {
    return this.getInventoryValuationUseCase.execute();
  }

  @Permissions('inventory.read')
  @Get('reservations')
  async reservations() {
    return this.getReservationsUseCase.execute();
  }

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

  @Permissions('inventory.settings.write', 'inventory.cost.write')
  @Patch('settings/:variantId/:warehouseId')
  async updateSettings(
    @Param('variantId') variantId: string,
    @Param('warehouseId') warehouseId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.inventoryItem.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId } },
    });
    if (!current) throw new NotFoundException('Inventario no encontrado.');

    const data = {
      minStock: this.optionalInteger(body.minStock, 'minStock'),
      maxStock: this.optionalInteger(body.maxStock, 'maxStock'),
      reorderPoint: this.optionalInteger(body.reorderPoint, 'reorderPoint'),
      reorderQty: this.optionalInteger(body.reorderQty, 'reorderQty'),
      costPrice: body.costPrice === undefined || body.costPrice === null || body.costPrice === ''
        ? undefined
        : this.nonNegativeNumber(body.costPrice, 'costPrice'),
    };
    const updated = await this.prisma.inventoryItem.update({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      data,
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.settings_updated',
      entityType: 'inventory_item',
      entityId: `${variantId}:${warehouseId}`,
      beforeData: this.redactInventoryItem(current),
      afterData: this.redactInventoryItem(updated),
      ipAddress,
      userAgent,
    });
    return this.redactInventoryItem(updated);
  }

  @Permissions('inventory.return')
  @Post('returns')
  async returnStock(
    @Body() body: Record<string, unknown>,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const orderItemId = this.requiredString(body.orderItemId, 'orderItemId');
    const warehouseId = this.requiredString(body.warehouseId, 'warehouseId');
    const quantity = this.positiveInteger(body.quantity, 'quantity');
    const condition = this.requiredString(body.condition, 'condition');
    const reason = this.requiredString(body.reason, 'reason');
    const comment = body.comment ? String(body.comment) : null;
    if (!['sellable', 'damaged', 'warranty_review', 'discarded'].includes(condition)) {
      throw new BadRequestException('Condición de devolución inválida.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const orderItem = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        include: { variant: true, order: true },
      });
      if (!orderItem) throw new NotFoundException('Item de pedido no encontrado.');

      const alreadyReturned = await tx.inventoryReturnLine.aggregate({
        where: { orderItemId },
        _sum: { quantity: true },
      });
      if ((alreadyReturned._sum.quantity ?? 0) + quantity > orderItem.quantity) {
        throw new ConflictException('No se puede devolver más cantidad que la vendida.');
      }

      const locked = await this.lockInventory(tx, orderItem.variantId, warehouseId);
      const delta = condition === 'sellable' ? quantity : 0;
      const updated = await tx.inventoryItem.update({
        where: { variantId_warehouseId: { variantId: orderItem.variantId, warehouseId } },
        data: { onHandQty: locked.onHandQty + delta },
      });
      const movement = await tx.stockMovement.create({
        data: {
          id: uuidv7(),
          movementType: StockMovementType.return_received,
          productId: orderItem.variant.productId,
          variantId: orderItem.variantId,
          sku: orderItem.variant.sku,
          warehouseId,
          quantity,
          quantityDelta: delta,
          quantityBefore: locked.onHandQty,
          quantityAfter: updated.onHandQty,
          referenceType: 'return',
          referenceId: `${orderItem.orderId}:${orderItemId}:${condition}:${(alreadyReturned._sum.quantity ?? 0) + quantity}`,
          orderId: orderItem.orderId,
          reasonCode: condition,
          reasonText: reason,
          reason,
          source: 'admin',
          rawMetadata: { condition, comment },
          createdByUserId: actor.sub,
        },
      });
      const returnLine = await tx.inventoryReturnLine.create({
        data: {
          id: uuidv7(),
          orderId: orderItem.orderId,
          orderItemId,
          variantId: orderItem.variantId,
          warehouseId,
          quantity,
          condition,
          reason,
          comment,
          stockMovementId: movement.id,
          createdByUserId: actor.sub,
        },
      });
      return { returnLine, movement, inventory: updated };
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.return_received',
      entityType: 'inventory_return_line',
      entityId: result.returnLine.id,
      afterData: result,
      ipAddress,
      userAgent,
    });
    return result;
  }

  @Permissions('inventory.count.write')
  @Post('count-sessions')
  async createCountSession(
    @Body() body: Record<string, unknown>,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const warehouseId = this.requiredString(body.warehouseId, 'warehouseId');
    const notes = body.notes ? String(body.notes) : null;
    const linesInput = Array.isArray(body.lines) ? body.lines as Array<Record<string, unknown>> : [];
    const session = await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse || !warehouse.isActive) throw new NotFoundException('Bodega no encontrada o inactiva.');
      const created = await tx.inventoryCountSession.create({
        data: {
          id: uuidv7(),
          warehouseId,
          status: 'in_progress',
          startedBy: actor.sub,
          notes,
        },
      });
      const inventoryRows = await tx.inventoryItem.findMany({
        where: { warehouseId },
        include: { variant: true },
      });
      const countedByVariant = new Map(linesInput.map((line) => [
        String(line.variantId),
        line.countedQuantity === undefined ? null : this.nonNegativeInteger(line.countedQuantity, 'countedQuantity'),
      ]));
      await tx.inventoryCountLine.createMany({
        data: inventoryRows.map((row) => {
          const counted = countedByVariant.has(row.variantId) ? countedByVariant.get(row.variantId) ?? null : null;
          return {
            id: uuidv7(),
            sessionId: created.id,
            variantId: row.variantId,
            sku: row.variant.sku,
            systemQuantity: row.onHandQty,
            countedQuantity: counted,
            difference: counted === null ? null : counted - row.onHandQty,
          };
        }),
      });
      return created;
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.count_started',
      entityType: 'inventory_count_session',
      entityId: session.id,
      afterData: session,
      ipAddress,
      userAgent,
    });
    return this.getCountSession(session.id);
  }

  @Permissions('inventory.count.write')
  @Patch('count-sessions/:sessionId/lines')
  async updateCountLines(@Param('sessionId') sessionId: string, @Body() body: Record<string, unknown>) {
    const lines = Array.isArray(body.lines) ? body.lines as Array<Record<string, unknown>> : [];
    if (!lines.length) throw new BadRequestException('Debe enviar líneas de conteo.');
    const session = await this.prisma.inventoryCountSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status === 'closed') throw new ConflictException('Sesión de conteo no editable.');
    for (const line of lines) {
      const variantId = this.requiredString(line.variantId, 'variantId');
      const counted = this.nonNegativeInteger(line.countedQuantity, 'countedQuantity');
      const current = await this.prisma.inventoryCountLine.findUnique({
        where: { sessionId_variantId: { sessionId, variantId } },
      });
      if (!current) throw new NotFoundException('Línea de conteo no encontrada.');
      await this.prisma.inventoryCountLine.update({
        where: { sessionId_variantId: { sessionId, variantId } },
        data: { countedQuantity: counted, difference: counted - current.systemQuantity },
      });
    }
    return this.getCountSession(sessionId);
  }

  @Permissions('inventory.count.close')
  @Post('count-sessions/:sessionId/close')
  async closeCountSession(
    @Param('sessionId') sessionId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.inventoryCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: { include: { variant: true } } },
      });
      if (!session) throw new NotFoundException('Sesión de conteo no encontrada.');
      if (session.status === 'closed') throw new ConflictException('La sesión ya está cerrada.');
      if (session.lines.every((line) => line.countedQuantity === null)) {
        throw new ConflictException('No se puede cerrar conteo sin ninguna línea contada.');
      }
      const movements = [];
      for (const line of session.lines) {
        if (line.countedQuantity === null) continue;
        const counted = line.countedQuantity ?? line.systemQuantity;
        const delta = counted - line.systemQuantity;
        if (delta === 0) continue;
        const locked = await this.lockInventory(tx, line.variantId, session.warehouseId);
        const next = locked.onHandQty + delta;
        if (next < 0 || locked.reservedQty + locked.committedQty > next) {
          throw new ConflictException('La corrección de conteo dejaría inventario inválido.');
        }
        const updated = await tx.inventoryItem.update({
          where: { variantId_warehouseId: { variantId: line.variantId, warehouseId: session.warehouseId } },
          data: { onHandQty: next },
        });
        const movement = await tx.stockMovement.create({
          data: {
            id: uuidv7(),
            movementType: StockMovementType.physical_count_correction,
            productId: line.variant.productId,
            variantId: line.variantId,
            sku: line.sku,
            warehouseId: session.warehouseId,
            quantity: Math.abs(delta),
            quantityDelta: delta,
            quantityBefore: locked.onHandQty,
            quantityAfter: updated.onHandQty,
            referenceType: 'inventory_count',
            referenceId: session.id,
            reasonCode: 'PHYSICAL_COUNT_CORRECTION',
            reasonText: session.notes,
            reason: session.notes,
            source: 'admin',
            rawMetadata: { countedQuantity: counted, systemQuantity: line.systemQuantity },
            createdByUserId: actor.sub,
          },
        });
        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: { adjustmentMovementId: movement.id },
        });
        movements.push(movement);
      }
      const closed = await tx.inventoryCountSession.update({
        where: { id: sessionId },
        data: { status: 'closed', closedBy: actor.sub, closedAt: new Date() },
      });
      return { session: closed, movements };
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.count_closed',
      entityType: 'inventory_count_session',
      entityId: sessionId,
      afterData: result,
      ipAddress,
      userAgent,
    });
    return result;
  }

  @Permissions('inventory.import')
  @Post('imports/dry-run')
  async importDryRun(
    @Body() body: Record<string, unknown>,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const csv = this.requiredString(body.csv, 'csv');
    const filename = body.filename ? String(body.filename) : 'inventory-import.csv';
    const parsed = await this.parseImportRows(csv);
    const batch = await this.prisma.inventoryImportBatch.create({
      data: {
        id: uuidv7(),
        status: parsed.errorRows > 0 ? 'dry_run_errors' : 'dry_run_valid',
        filename,
        totalRows: parsed.rows.length,
        validRows: parsed.rows.filter((row) => row.valid).length,
        errorRows: parsed.errorRows,
        createdBy: actor.sub,
        rows: {
          createMany: {
            data: parsed.rows.map((row) => ({ ...row, id: uuidv7() })),
          },
        },
      },
      include: { rows: true },
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.import_dry_run',
      entityType: 'inventory_import_batch',
      entityId: batch.id,
      afterData: { id: batch.id, totalRows: batch.totalRows, validRows: batch.validRows, errorRows: batch.errorRows },
      ipAddress,
      userAgent,
    });
    return batch;
  }

  @Permissions('inventory.import')
  @Post('imports/:batchId/apply')
  async applyImport(
    @Param('batchId') batchId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryImportBatch.findUnique({ where: { id: batchId }, include: { rows: true } });
      if (!batch) throw new NotFoundException('Import batch no encontrado.');
      if (!batch.status.startsWith('dry_run')) throw new ConflictException('Este import ya no está en dry-run.');
      if (batch.errorRows > 0) throw new ConflictException('No se puede aplicar import con errores críticos.');
      const movements = [];
      for (const row of batch.rows) {
        const variant = await tx.variant.findUnique({ where: { sku: row.sku } });
        const warehouse = await tx.warehouse.findUnique({ where: { code: row.warehouseCode } });
        if (!variant || !warehouse) throw new ConflictException('El import cambió de validez antes de aplicar.');
        const locked = await this.lockInventory(tx, variant.id, warehouse.id, true);
        const delta = row.mode === 'set'
          ? row.quantity - locked.onHandQty
          : row.mode === 'increment'
            ? row.quantity
            : -row.quantity;
        const next = locked.onHandQty + delta;
        if (next < 0 || locked.reservedQty + locked.committedQty > next) {
          throw new ConflictException(`Import dejaría stock inválido para SKU ${row.sku}.`);
        }
        const updated = await tx.inventoryItem.update({
          where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } },
          data: { onHandQty: next },
        });
        const movement = await tx.stockMovement.create({
          data: {
            id: uuidv7(),
            movementType: StockMovementType.import_adjustment,
            productId: variant.productId,
            variantId: variant.id,
            sku: variant.sku,
            warehouseId: warehouse.id,
            quantity: Math.abs(delta),
            quantityDelta: delta,
            quantityBefore: locked.onHandQty,
            quantityAfter: updated.onHandQty,
            referenceType: 'inventory_import',
            referenceId: batch.id,
            reasonCode: row.reason,
            reasonText: row.reason,
            reason: row.reason,
            source: 'import',
            rawMetadata: { rowNumber: row.rowNumber, mode: row.mode },
            createdByUserId: actor.sub,
          },
        });
        await tx.inventoryImportRow.update({ where: { id: row.id }, data: { movementId: movement.id } });
        movements.push(movement);
      }
      const applied = await tx.inventoryImportBatch.update({
        where: { id: batch.id },
        data: { status: 'applied', appliedBy: actor.sub, appliedAt: new Date() },
      });
      return { batch: applied, movements };
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.import_applied',
      entityType: 'inventory_import_batch',
      entityId: batchId,
      afterData: { batchId, movements: result.movements.length },
      ipAddress,
      userAgent,
    });
    return result;
  }

  @Permissions('inventory.export')
  @Get('export')
  async exportInventory(@CurrentUserDecorator() actor: CurrentUser, @Res() res: Response) {
    const rows = await this.prisma.inventoryItem.findMany({
      include: { variant: { include: { product: true } }, warehouse: true },
      orderBy: [{ warehouse: { code: 'asc' } }, { variant: { sku: 'asc' } }],
    });
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'inventory.exported',
      entityType: 'inventory_export',
      entityId: `export-${Date.now()}`,
      afterData: { rows: rows.length },
    });
    const header = 'sku,product,variant,warehouseCode,warehouse,physicalStock,reservedStock,committedStock,availableStock,minStock,costPrice,inventoryValue';
    const lines = rows.map((row) => {
      const available = this.available(row);
      const cost = row.costPrice ? Number(row.costPrice) : null;
      const value = cost === null ? '' : String(available * cost);
      return [
        row.variant.sku,
        row.variant.product?.name ?? '',
        row.variant.name,
        row.warehouse.code,
        row.warehouse.name,
        row.onHandQty,
        row.reservedQty,
        row.committedQty,
        available,
        row.minStock ?? '',
        cost ?? '',
        value,
      ].map((cell) => this.csvCell(cell)).join(',');
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"inventory-export.csv\"');
    return res.send([header, ...lines].join('\n'));
  }

  private async getCountSession(sessionId: string) {
    const session = await this.prisma.inventoryCountSession.findUnique({
      where: { id: sessionId },
      include: { warehouse: true, lines: { orderBy: { sku: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Sesión de conteo no encontrada.');
    return session;
  }

  private available(row: { onHandQty: number; reservedQty: number; committedQty?: number | null }) {
    return row.onHandQty - row.reservedQty - (row.committedQty ?? 0);
  }

  private async lockInventory(tx: PrismaTransactionClient, variantId: string, warehouseId: string, createIfMissing = false) {
    const rows = (await tx.$queryRaw`
      SELECT id, variant_id, warehouse_id, on_hand_qty, reserved_qty, committed_qty
      FROM inventory_items
      WHERE variant_id = ${variantId}::uuid AND warehouse_id = ${warehouseId}::uuid
      FOR UPDATE
    `) as Array<{ id: string; variant_id: string; warehouse_id: string; on_hand_qty: number; reserved_qty: number; committed_qty: number }>;
    const [row] = rows;
    if (!row && createIfMissing) {
      const created = await tx.inventoryItem.create({
        data: { id: uuidv7(), variantId, warehouseId, onHandQty: 0, reservedQty: 0, committedQty: 0 },
      });
      return created;
    }
    if (!row) throw new NotFoundException('Inventario no encontrado para variante/bodega.');
    return {
      id: row.id,
      variantId: row.variant_id,
      warehouseId: row.warehouse_id,
      onHandQty: Number(row.on_hand_qty),
      reservedQty: Number(row.reserved_qty),
      committedQty: Number(row.committed_qty),
    };
  }

  private async parseImportRows(csv: string) {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('El CSV debe incluir encabezado y al menos una fila.');
    const headers = lines[0].split(',').map((header) => header.trim());
    const required = ['sku', 'warehouseCode', 'quantity', 'mode', 'reason'];
    for (const requiredHeader of required) {
      if (!headers.includes(requiredHeader)) throw new BadRequestException(`Falta columna ${requiredHeader}.`);
    }
    const variants = await this.prisma.variant.findMany({ select: { sku: true } });
    const warehouses = await this.prisma.warehouse.findMany({ select: { code: true } });
    const variantSet = new Set(variants.map((variant) => variant.sku));
    const warehouseSet = new Set(warehouses.map((warehouse) => warehouse.code));
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(',').map((value) => value.trim());
      const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? '']));
      const errors = [];
      const quantity = Number(record.quantity);
      if (!variantSet.has(record.sku)) errors.push('SKU no existe.');
      if (!warehouseSet.has(record.warehouseCode)) errors.push('Bodega no existe.');
      if (!Number.isInteger(quantity) || quantity < 0) errors.push('Cantidad inválida.');
      if (!['set', 'increment', 'decrement'].includes(record.mode)) errors.push('Modo inválido.');
      if (!record.reason) errors.push('Motivo obligatorio.');
      return {
        rowNumber: index + 2,
        sku: record.sku,
        warehouseCode: record.warehouseCode,
        quantity: Number.isInteger(quantity) ? quantity : 0,
        mode: record.mode,
        reason: record.reason,
        valid: errors.length === 0,
        errors,
      };
    });
    return { rows, errorRows: rows.filter((row) => !row.valid).length };
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} es obligatorio.`);
    return value.trim();
  }

  private positiveInteger(value: unknown, field: string) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) throw new BadRequestException(`${field} debe ser entero positivo.`);
    return numeric;
  }

  private nonNegativeInteger(value: unknown, field: string) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0) throw new BadRequestException(`${field} debe ser entero no negativo.`);
    return numeric;
  }

  private optionalInteger(value: unknown, field: string) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return this.nonNegativeInteger(value, field);
  }

  private nonNegativeNumber(value: unknown, field: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) throw new BadRequestException(`${field} debe ser número no negativo.`);
    return numeric;
  }

  private redactInventoryItem(item: { variantId: string; warehouseId: string; onHandQty: number; reservedQty: number; committedQty?: number | null; minStock?: number | null; costPrice?: unknown }) {
    return {
      variantId: item.variantId,
      warehouseId: item.warehouseId,
      physicalStock: item.onHandQty,
      reservedStock: item.reservedQty,
      committedStock: item.committedQty ?? 0,
      minStock: item.minStock ?? null,
      costConfigured: item.costPrice !== null && item.costPrice !== undefined,
    };
  }

  private csvCell(value: unknown) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }
}
