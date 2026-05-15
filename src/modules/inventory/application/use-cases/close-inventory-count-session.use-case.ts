import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

export interface CloseCountSessionInput {
  sessionId: string;
  actor: { sub: string };
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class CloseInventoryCountSessionUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: CloseCountSessionInput) {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.inventoryCountSession.findUnique({
        where: { id: input.sessionId }, include: { lines: { include: { variant: true } } },
      });
      if (!session) throw new NotFoundException('Sesión de conteo no encontrada.');
      if (session.status === 'closed') throw new ConflictException('La sesión ya está cerrada.');
      if (session.lines.every((line) => line.countedQuantity === null))
        throw new ConflictException('No se puede cerrar conteo sin ninguna línea contada.');

      const movements = [];
      for (const line of session.lines) {
        if (line.countedQuantity === null) continue;
        const counted = line.countedQuantity ?? line.systemQuantity;
        const delta = counted - line.systemQuantity;
        if (delta === 0) continue;
        const locked = await lockRow(tx, line.variantId, session.warehouseId);
        const next = locked.onHandQty + delta;
        if (next < 0 || locked.reservedQty + locked.committedQty > next)
          throw new ConflictException('La corrección de conteo dejaría inventario inválido.');
        const updated = await tx.inventoryItem.update({
          where: { variantId_warehouseId: { variantId: line.variantId, warehouseId: session.warehouseId } },
          data: { onHandQty: next },
        });
        const movement = await tx.stockMovement.create({
          data: {
            id: uuidv7(), movementType: StockMovementType.physical_count_correction,
            productId: line.variant.productId, variantId: line.variantId, sku: line.sku,
            warehouseId: session.warehouseId, quantity: Math.abs(delta), quantityDelta: delta,
            quantityBefore: locked.onHandQty, quantityAfter: updated.onHandQty,
            referenceType: 'inventory_count', referenceId: session.id,
            reasonCode: 'PHYSICAL_COUNT_CORRECTION', reasonText: session.notes, reason: session.notes,
            source: 'admin',
            rawMetadata: { countedQuantity: counted, systemQuantity: line.systemQuantity },
            createdByUserId: input.actor.sub,
          },
        });
        await tx.inventoryCountLine.update({ where: { id: line.id }, data: { adjustmentMovementId: movement.id } });
        movements.push(movement);
      }
      const closed = await tx.inventoryCountSession.update({
        where: { id: input.sessionId },
        data: { status: 'closed', closedBy: input.actor.sub, closedAt: new Date() },
      });
      return { session: closed, movements };
    });
    await this.auditRepository.write({
      actorUserId: input.actor.sub, action: 'inventory.count_closed',
      entityType: 'inventory_count_session', entityId: input.sessionId, afterData: result,
      ipAddress: input.ipAddress, userAgent: input.userAgent,
    });
    return result;
  }
}

async function lockRow(tx: PrismaTransactionClient, variantId: string, warehouseId: string) {
  const rows = (await tx.$queryRaw`
    SELECT id, variant_id, warehouse_id, on_hand_qty, reserved_qty, committed_qty
    FROM inventory_items WHERE variant_id = ${variantId}::uuid AND warehouse_id = ${warehouseId}::uuid FOR UPDATE
  `) as Array<{ id: string; variant_id: string; warehouse_id: string; on_hand_qty: number; reserved_qty: number; committed_qty: number }>;
  const [row] = rows;
  if (!row) throw new NotFoundException('Inventario no encontrado para variante/bodega.');
  return { id: row.id, variantId: row.variant_id, warehouseId: row.warehouse_id, onHandQty: Number(row.on_hand_qty), reservedQty: Number(row.reserved_qty), committedQty: Number(row.committed_qty) };
}
