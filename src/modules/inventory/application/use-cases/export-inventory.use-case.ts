import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

@Injectable()
export class ExportInventoryUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: { actor: { sub: string } }) {
    const rows = await this.prisma.inventoryItem.findMany({
      include: { variant: { include: { product: true } }, warehouse: true },
      orderBy: [{ warehouse: { code: 'asc' } }, { variant: { sku: 'asc' } }],
    });
    await this.auditRepository.write({
      actorUserId: input.actor.sub, action: 'inventory.exported',
      entityType: 'inventory_export', entityId: `export-${Date.now()}`,
      afterData: { rows: rows.length },
    });
    const header = 'sku,product,variant,warehouseCode,warehouse,physicalStock,reservedStock,committedStock,availableStock,minStock,costPrice,inventoryValue';
    const lines = rows.map((row) => {
      const available = row.onHandQty - row.reservedQty - row.committedQty;
      const cost = row.costPrice ? Number(row.costPrice) : null;
      const value = cost === null ? '' : String(available * cost);
      return [
        row.variant.sku, row.variant.product?.name ?? '', row.variant.name,
        row.warehouse.code, row.warehouse.name, row.onHandQty, row.reservedQty, row.committedQty,
        available, row.minStock ?? '', cost ?? '', value,
      ].map((cell) => csvCell(cell)).join(',');
    });
    return [header, ...lines].join('\n');
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
