import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

export interface CreateCountSessionInput {
  body: Record<string, unknown>;
  actor: { sub: string };
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class CreateInventoryCountSessionUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: CreateCountSessionInput) {
    const warehouseId = requiredStr(input.body.warehouseId, 'warehouseId');
    const notes = input.body.notes ? String(input.body.notes) : null;
    const linesInput = Array.isArray(input.body.lines) ? input.body.lines as Array<Record<string, unknown>> : [];

    const session = await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse || !warehouse.isActive) throw new NotFoundException('Bodega no encontrada o inactiva.');
      const created = await tx.inventoryCountSession.create({
        data: { id: uuidv7(), warehouseId, status: 'in_progress', startedBy: input.actor.sub, notes },
      });
      const inventoryRows = await tx.inventoryItem.findMany({ where: { warehouseId }, include: { variant: true } });
      const countedByVariant = new Map(linesInput.map((line) => [
        String(line.variantId),
        line.countedQuantity === undefined ? null : nonNegInt(line.countedQuantity, 'countedQuantity'),
      ]));
      await tx.inventoryCountLine.createMany({
        data: inventoryRows.map((row) => {
          const counted = countedByVariant.has(row.variantId) ? countedByVariant.get(row.variantId) ?? null : null;
          return {
            id: uuidv7(), sessionId: created.id, variantId: row.variantId, sku: row.variant.sku,
            systemQuantity: row.onHandQty, countedQuantity: counted,
            difference: counted === null ? null : counted - row.onHandQty,
          };
        }),
      });
      return created;
    });
    await this.auditRepository.write({
      actorUserId: input.actor.sub, action: 'inventory.count_started',
      entityType: 'inventory_count_session', entityId: session.id, afterData: session,
      ipAddress: input.ipAddress, userAgent: input.userAgent,
    });
    return getSession(this.prisma, session.id);
  }
}

export async function getSession(prisma: PrismaService, sessionId: string) {
  const session = await prisma.inventoryCountSession.findUnique({
    where: { id: sessionId }, include: { warehouse: true, lines: { orderBy: { sku: 'asc' } } },
  });
  if (!session) throw new NotFoundException('Sesión de conteo no encontrada.');
  return session;
}

function requiredStr(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} es requerido.`);
  return value;
}

function nonNegInt(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new BadRequestException(`${field} debe ser entero no negativo.`);
  return n;
}
