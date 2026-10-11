import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { csvCell as safeCsvCell } from 'src/modules/analytics/application/services/csv-cell-sanitizer';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

@Injectable()
export class ExportInventoryUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: { actor: CurrentUser }) {
    const permissions = Array.isArray(input.actor.permissions) ? input.actor.permissions : [];
    assertHasPermissions(permissions, ['inventory.export']);
    const canReadCost = permissions.includes('inventory.cost.read');
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
        available, row.minStock ?? '', canReadCost ? cost ?? '' : 'NO_PERMISSION',
        canReadCost ? value : 'NO_PERMISSION',
      ].map((cell) => csvCell(cell)).join(',');
    });
    return [header, ...lines].join('\n');
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = safeCsvCell(value);
  const quoted = `"${text.replaceAll('"', '""')}"`;
  if (safe !== quoted) return safe;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
