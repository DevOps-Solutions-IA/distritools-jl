import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

export interface ApplyImportInput {
  batchId: string;
  actor: { sub: string };
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class ApplyInventoryImportUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: ApplyImportInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory_import_batches WHERE id = ${input.batchId}::uuid FOR UPDATE`;
      const batch = await tx.inventoryImportBatch.findUnique({ where: { id: input.batchId }, include: { rows: true } });
      if (!batch) throw new NotFoundException('Import batch no encontrado.');
      if (!batch.status.startsWith('dry_run')) throw new ConflictException('Este import ya no está en dry-run.');
      if (batch.errorRows > 0) throw new ConflictException('No se puede aplicar import con errores críticos.');
      const movements = [];
      for (const row of batch.rows) {
        const variant = await tx.variant.findUnique({ where: { sku: row.sku } });
        const warehouse = await tx.warehouse.findUnique({ where: { code: row.warehouseCode } });
        if (!variant || !warehouse) throw new ConflictException('El import cambió de validez antes de aplicar.');
        const locked = await lockRow(tx, variant.id, warehouse.id, true);
        const delta = row.mode === 'set' ? row.quantity - locked.onHandQty : row.mode === 'increment' ? row.quantity : -row.quantity;
        const next = locked.onHandQty + delta;
        if (next < 0 || locked.reservedQty + locked.committedQty > next)
          throw new ConflictException(`Import dejaría stock inválido para SKU ${row.sku}.`);
        const updated = await tx.inventoryItem.update({
          where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } }, data: { onHandQty: next },
        });
        const movement = await tx.stockMovement.create({
          data: {
            id: uuidv7(), movementType: StockMovementType.import_adjustment,
            productId: variant.productId, variantId: variant.id, sku: variant.sku, warehouseId: warehouse.id,
            quantity: Math.abs(delta), quantityDelta: delta, quantityBefore: locked.onHandQty, quantityAfter: updated.onHandQty,
            referenceType: 'inventory_import', referenceId: batch.id, reasonCode: row.reason, reasonText: row.reason, reason: row.reason,
            source: 'import', rawMetadata: { rowNumber: row.rowNumber, mode: row.mode }, createdByUserId: input.actor.sub,
          },
        });
        await tx.inventoryImportRow.update({ where: { id: row.id }, data: { movementId: movement.id } });
        movements.push(movement);
      }
      const applied = await tx.inventoryImportBatch.update({
        where: { id: batch.id }, data: { status: 'applied', appliedBy: input.actor.sub, appliedAt: new Date() },
      });
      await this.auditRepository.write({
        actorUserId: input.actor.sub, action: 'inventory.import_applied',
        entityType: 'inventory_import_batch', entityId: input.batchId,
        afterData: { batchId: input.batchId, movements: movements.length },
        ipAddress: input.ipAddress, userAgent: input.userAgent,
      }, tx);
      return { batch: applied, movements };
    });
  }
}

async function lockRow(tx: PrismaTransactionClient, variantId: string, warehouseId: string, createIfMissing = false) {
  const rows = (await tx.$queryRaw`
    SELECT id, variant_id, warehouse_id, on_hand_qty, reserved_qty, committed_qty
    FROM inventory_items WHERE variant_id = ${variantId}::uuid AND warehouse_id = ${warehouseId}::uuid FOR UPDATE
  `) as Array<{ id: string; variant_id: string; warehouse_id: string; on_hand_qty: number; reserved_qty: number; committed_qty: number }>;
  const [row] = rows;
  if (!row && createIfMissing) {
    const created = await tx.inventoryItem.create({ data: { id: uuidv7(), variantId, warehouseId, onHandQty: 0, reservedQty: 0, committedQty: 0 } });
    return created;
  }
  if (!row) throw new NotFoundException('Inventario no encontrado para variante/bodega.');
  return { id: row.id, variantId: row.variant_id, warehouseId: row.warehouse_id, onHandQty: Number(row.on_hand_qty), reservedQty: Number(row.reserved_qty), committedQty: Number(row.committed_qty) };
}
