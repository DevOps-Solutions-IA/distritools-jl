import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

export interface DryRunImportInput {
  body: Record<string, unknown>;
  actor: { sub: string };
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class DryRunInventoryImportUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: DryRunImportInput) {
    const csv = reqStr(input.body.csv, 'csv');
    const filename = input.body.filename ? String(input.body.filename) : 'inventory-import.csv';
    const parsed = await parseImportRows(this.prisma, csv);

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryImportBatch.create({
        data: {
          id: uuidv7(),
          status: parsed.errorRows > 0 ? 'dry_run_errors' : 'dry_run_valid',
          filename, totalRows: parsed.rows.length,
          validRows: parsed.rows.filter((row) => row.valid).length,
          errorRows: parsed.errorRows, createdBy: input.actor.sub,
          rows: { createMany: { data: parsed.rows.map((row) => ({ ...row, id: uuidv7() })) } },
        },
        include: { rows: true },
      });
      await this.auditRepository.write({
        actorUserId: input.actor.sub, action: 'inventory.import_dry_run',
        entityType: 'inventory_import_batch', entityId: batch.id,
        afterData: { id: batch.id, totalRows: batch.totalRows, validRows: batch.validRows, errorRows: batch.errorRows },
        ipAddress: input.ipAddress, userAgent: input.userAgent,
      }, tx);
      return batch;
    });
  }
}

async function parseImportRows(prisma: PrismaService, csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new BadRequestException('El CSV debe incluir encabezado y al menos una fila.');
  const headers = lines[0].split(',').map((h) => h.trim());
  for (const req of ['sku', 'warehouseCode', 'quantity', 'mode', 'reason'])
    if (!headers.includes(req)) throw new BadRequestException(`Falta columna ${req}.`);
  const variants = await prisma.variant.findMany({ select: { sku: true } });
  const warehouses = await prisma.warehouse.findMany({ select: { code: true } });
  const variantSet = new Set(variants.map((v) => v.sku));
  const warehouseSet = new Set(warehouses.map((w) => w.code));
  const rows = [];
  let errorRows = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => { record[h] = cells[idx] ?? ''; });
    const errors: string[] = [];
    if (!variantSet.has(record.sku)) errors.push(`SKU ${record.sku} no encontrado.`);
    if (!warehouseSet.has(record.warehouseCode)) errors.push(`Bodega ${record.warehouseCode} no encontrada.`);
    const qty = Number(record.quantity);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < -2147483648 || qty > 2147483647) {
      throw new BadRequestException(`Fila ${i}: quantity debe ser un entero entre -2147483648 y 2147483647.`);
    }
    if (qty < 0) errors.push('Cantidad inválida.');
    if (!['set', 'increment', 'decrement'].includes(record.mode)) errors.push(`Modo ${record.mode} inválido.`);
    if (!record.reason?.trim()) errors.push('Falta motivo.');
    const valid = errors.length === 0;
    if (!valid) errorRows++;
    rows.push({ rowNumber: i, sku: record.sku, warehouseCode: record.warehouseCode, quantity: qty, mode: record.mode, reason: record.reason, valid, errors: errors.length ? errors : undefined });
  }
  return { rows, errorRows };
}

function reqStr(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} es requerido.`);
  return value;
}
