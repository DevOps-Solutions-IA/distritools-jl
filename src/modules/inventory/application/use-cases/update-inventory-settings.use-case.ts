import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';

export interface UpdateInventorySettingsInput {
  variantId: string;
  warehouseId: string;
  body: Record<string, unknown>;
  actor: { sub: string };
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class UpdateInventorySettingsUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: UpdateInventorySettingsInput) {
    const current = await this.prisma.inventoryItem.findUnique({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
      },
    });
    if (!current) throw new NotFoundException('Inventario no encontrado.');

    const data = {
      minStock: optionalInteger(input.body.minStock, 'minStock'),
      maxStock: optionalInteger(input.body.maxStock, 'maxStock'),
      reorderPoint: optionalInteger(input.body.reorderPoint, 'reorderPoint'),
      reorderQty: optionalInteger(input.body.reorderQty, 'reorderQty'),
      costPrice:
        input.body.costPrice === undefined || input.body.costPrice === null || input.body.costPrice === ''
          ? undefined
          : nonNegativeNumber(input.body.costPrice, 'costPrice'),
    };
    const updated = await this.prisma.inventoryItem.update({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
      },
      data,
    });
    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'inventory.settings_updated',
      entityType: 'inventory_item',
      entityId: `${input.variantId}:${input.warehouseId}`,
      beforeData: redactItem(current),
      afterData: redactItem(updated),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return redactItem(updated);
  }
}

function optionalInteger(value: unknown, label: string): number | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isInteger(n)) throw new Error(`${label} debe ser entero.`);
  return n;
}

function nonNegativeNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) throw new Error(`${label} debe ser un número no negativo.`);
  return n;
}

function redactItem(item: { variantId: string; warehouseId: string; onHandQty: number; reservedQty: number; committedQty?: number | null; minStock?: number | null; costPrice?: unknown }) {
  return {
    variantId: item.variantId,
    warehouseId: item.warehouseId,
    onHandQty: item.onHandQty,
    reservedQty: item.reservedQty,
    committedQty: item.committedQty ?? 0,
    minStock: item.minStock ?? null,
    costPrice: item.costPrice ?? null,
  };
}
