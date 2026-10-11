import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExportInventoryUseCase } from 'src/modules/inventory/application/use-cases/export-inventory.use-case';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

const header = 'sku,product,variant,warehouseCode,warehouse,physicalStock,reservedStock,committedStock,availableStock,minStock,costPrice,inventoryValue';
const actor = (permissions: unknown) => ({ sub: 'operator', email: 'operator@example.test', role: 'exporter', sessionId: 'private-session', permissions }) as never;
function fixture(cost: unknown = new Prisma.Decimal(100), name = 'Product') {
  const rows = [{ variant: { sku: 'SKU', name: 'Variant', product: { name } }, warehouse: { code: 'WH', name: 'Warehouse' }, onHandQty: 20, reservedQty: 3, committedQty: 1, minStock: 2, costPrice: cost }];
  const audits: unknown[] = []; let reads = 0;
  const prisma = { inventoryItem: { findMany: async () => { reads++; return rows; } } } as unknown as PrismaService;
  const audit = { write: async (entry: unknown) => { audits.push(entry); } } as unknown as AuditRepository;
  return { useCase: new ExportInventoryUseCase(prisma, audit), rows, audits, reads: () => reads };
}
describe('EX08 inventory CSV financial boundary', () => {
  it('redacts both financial cells while preserving nonfinancial rows and audit', async () => {
    const f = fixture(); const before = JSON.stringify(f.rows);
    const csv = await f.useCase.execute({ actor: actor(['inventory.read', 'inventory.export']) });
    assert.equal(csv, header + '\nSKU,Product,Variant,WH,Warehouse,20,3,1,16,2,NO_PERMISSION,NO_PERMISSION');
    assert.equal(JSON.stringify(f.rows), before); assert.equal(f.audits.length, 1);
    assert.equal((f.audits[0] as {action:string}).action, 'inventory.exported');
    assert.ok(!csv.includes('operator')); assert.ok(!csv.includes('operator@example.test')); assert.ok(!csv.includes('private-session'));
  });
  it('preserves authorized full CSV bytes and zero/null financial meaning', async () => {
    for (const [cost, suffix] of [[new Prisma.Decimal(100), '100,1600'], [new Prisma.Decimal(0), '0,0'], [null, ',']] as const) {
      const csv = await fixture(cost).useCase.execute({ actor: actor(['inventory.export', 'inventory.cost.read']) });
      assert.equal(csv, header + '\nSKU,Product,Variant,WH,Warehouse,20,3,1,16,2,' + suffix);
    }
  });
  it('rejects absent export and malformed permissions before reads/audit', async () => {
    for (const permissions of [undefined, null, {}, 'inventory.export inventory.cost.read', [], ['inventory.cost.read'], ['inventory.export.fake']]) {
      const f = fixture(); await assert.rejects(f.useCase.execute({ actor: actor(permissions) }), ForbiddenException);
      assert.equal(f.reads(), 0); assert.equal(f.audits.length, 0);
    }
  });
  it('uses exact cost permission and never substitutes real zero or null without permission', async () => {
    for (const cost of [new Prisma.Decimal(0), null, new Prisma.Decimal(-2)]) {
      const csv = await fixture(cost).useCase.execute({ actor: actor(['inventory.export', 'inventory.cost.read.fake']) });
      assert.ok(csv.endsWith(',NO_PERMISSION,NO_PERMISSION'));
    }
  });
  it('escapes quotes, comma, newline and carriage return as one CSV cell', async () => {
    const name = 'Product, "quoted"\nline\rreturn';
    const csv = await fixture(undefined, name).useCase.execute({ actor: actor(['inventory.export', 'inventory.cost.read']) });
    assert.ok(csv.includes('"Product, ""quoted""\nline\rreturn"'));
    const cr = await fixture(undefined, 'Product\rline').useCase.execute({ actor: actor(['inventory.export']) });
    assert.ok(cr.includes('"Product\rline"'));
  });
  it('neutralizes text formulas including whitespace/control prefix and keeps negative numbers numeric', async () => {
    for (const name of ['=1+1', '+SUM(1,2)', '-SUM(1,2)', '@SUM(1,2)', '\t=1+1', '\r=1+1']) {
      const csv = await fixture(new Prisma.Decimal(-2), name).useCase.execute({ actor: actor(['inventory.export', 'inventory.cost.read']) });
      assert.ok(csv.includes(`"'${name}"`), 'unsafe formula: ' + JSON.stringify(name));
      assert.ok(csv.endsWith(',-2,-32'));
    }
  });
  it('propagates audit failure rather than returning CSV', async () => {
    const prisma = { inventoryItem: { findMany: async () => fixture().rows } } as unknown as PrismaService;
    const audit = { write: async () => { throw new Error('audit unavailable'); } } as unknown as AuditRepository;
    await assert.rejects(new ExportInventoryUseCase(prisma, audit).execute({ actor: actor(['inventory.export']) }), /audit unavailable/);
  });
});
