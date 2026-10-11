import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { DryRunInventoryImportUseCase } from 'src/modules/inventory/application/use-cases/dry-run-inventory-import.use-case';

function service() {
  const effects = { transactions: 0, batches: 0, audits: 0 };
  const tx = { inventoryImportBatch: { create: async ({ data }: { data: Record<string, unknown> }) => {
    effects.batches++;
    return { ...data, rows: (data.rows as { createMany: { data: unknown[] } }).createMany.data };
  } } };
  const prisma = {
    variant: { findMany: async () => [{ sku: 'SKU' }] },
    warehouse: { findMany: async () => [{ code: 'W' }] },
    $transaction: async (run: (value: typeof tx) => Promise<unknown>) => { effects.transactions++; return run(tx); },
  } as unknown as PrismaService;
  const audit = { write: async () => { effects.audits++; } } as unknown as AuditRepository;
  const useCase = new DryRunInventoryImportUseCase(prisma, audit);
  return { effects, run: (rows: string) => useCase.execute({ body: { csv: 'sku,warehouseCode,quantity,mode,reason\n' + rows }, actor: { sub: 'editor' }, ipAddress: '127.0.0.1' }) };
}
describe('EX08 import quantity must fit existing PostgreSQL Int before persistence', () => {
  for (const quantity of ['not-a-number', 'NaN', 'Infinity', '-Infinity', '1.5', '2147483648', '-2147483649', '9007199254740993']) {
    it(`rejects ${quantity} as concrete recoverable400 without transaction/batch/audit`, async () => {
      const s = service();
      await assert.rejects(s.run(`SKU,W,${quantity},increment,Reason`), (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        assert.match(error.message, /Fila 1.*quantity.*entero.*2147483647/);
        return true;
      });
      assert.deepEqual(s.effects, { transactions: 0, batches: 0, audits: 0 });
    });
  }
  it('rejects the entire mixed CSV before persisting its preceding valid row', async () => {
    const s = service();
    await assert.rejects(s.run('SKU,W,2,increment,Good\nSKU,W,NaN,increment,Bad'), (error: unknown) => {
      assert.ok(error instanceof BadRequestException); assert.match(error.message, /Fila 2/); return true;
    });
    assert.deepEqual(s.effects, { transactions: 0, batches: 0, audits: 0 });
  });
  it('preserves zero, maxInt and representable negative integers without replacing their values', async () => {
    const s = service(); const batch = await s.run('SKU,W,0,increment,Zero\nSKU,W,2147483647,set,Max\nSKU,W,-2147483648,increment,Negative') as unknown as { status: string; errorRows: number; rows: { quantity: number; valid: boolean; errors?: string[] }[] };
    assert.equal(batch.status, 'dry_run_errors'); assert.equal(batch.errorRows, 1);
    assert.deepEqual(batch.rows.map(r => r.quantity), [0, 2147483647, -2147483648]);
    assert.deepEqual(batch.rows.map(r => r.valid), [true, true, false]);
    assert.deepEqual(batch.rows[2].errors, ['Cantidad inválida.']);
    assert.deepEqual(s.effects, { transactions: 1, batches: 1, audits: 1 });
  });
  it('preserves independent SKU, warehouse, mode and reason error batch semantics', async () => {
    const s = service(); const batch = await s.run('missing,missing,1,bad,') as unknown as { status: string; rows: { errors: string[]; quantity: number }[] };
    assert.equal(batch.status, 'dry_run_errors'); assert.equal(batch.rows[0].quantity, 1);
    assert.deepEqual(batch.rows[0].errors, ['SKU missing no encontrado.', 'Bodega missing no encontrada.', 'Modo bad inválido.', 'Falta motivo.']);
    assert.deepEqual(s.effects, { transactions: 1, batches: 1, audits: 1 });
  });
});
