import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';

const VALID_CONDITIONS = ['sellable', 'damaged', 'warranty_review', 'discarded'];

export interface ProcessReturnInput {
  body: Record<string, unknown>;
  actor: { sub: string };
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class ProcessReturnUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: ProcessReturnInput) {
    const orderItemId = requiredString(input.body.orderItemId, 'orderItemId');
    const warehouseId = requiredString(input.body.warehouseId, 'warehouseId');
    const quantity = positiveInteger(input.body.quantity, 'quantity');
    const condition = requiredString(input.body.condition, 'condition');
    const reason = requiredString(input.body.reason, 'reason');
    const comment = input.body.comment ? String(input.body.comment) : null;
    if (!VALID_CONDITIONS.includes(condition)) {
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

      const locked = await lockRow(tx, orderItem.variantId, warehouseId);
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
          createdByUserId: input.actor.sub,
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
          createdByUserId: input.actor.sub,
        },
      });
      return { returnLine, movement, inventory: updated };
    });
    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'inventory.return_received',
      entityType: 'inventory_return_line',
      entityId: result.returnLine.id,
      afterData: result,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return result;
  }
}

async function lockRow(tx: PrismaTransactionClient, variantId: string, warehouseId: string) {
  const rows = (await tx.$queryRaw`
    SELECT id, variant_id, warehouse_id, on_hand_qty, reserved_qty, committed_qty
    FROM inventory_items
    WHERE variant_id = ${variantId}::uuid AND warehouse_id = ${warehouseId}::uuid
    FOR UPDATE
  `) as Array<{ id: string; variant_id: string; warehouse_id: string; on_hand_qty: number; reserved_qty: number; committed_qty: number }>;
  const [row] = rows;
  if (!row) throw new NotFoundException('Inventario no encontrado para variante/bodega.');
  return {
    id: row.id,
    variantId: row.variant_id,
    warehouseId: row.warehouse_id,
    onHandQty: row.on_hand_qty,
    reservedQty: row.reserved_qty,
    committedQty: row.committed_qty,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} es requerido.`);
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new BadRequestException(`${field} debe ser entero positivo.`);
  return n;
}
