import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InventoryReadQueryDto, UpdateInventoryCountLinesDto } from 'src/modules/inventory/infrastructure/http/dto/inventory-read-query.dto';
import { GetInventoryCountSessionsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-count-sessions.use-case';
import { GetInventoryImportsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-imports.use-case';
import { InventoryOperationReadRepository } from 'src/modules/inventory/domain/repositories/inventory-operation-read.repository';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

const options = { whitelist: true, forbidNonWhitelisted: true };
describe('EX08 inventory validation and read authorization', () => {
  it('accepts bounded query defaults and rejects malformed, repeated, unknown or overflowing inputs', () => {
    assert.equal(validateSync(plainToInstance(InventoryReadQueryDto, {}), options).length, 0);
    for (const query of [{ page: '0' }, { page: '1.5' }, { page: '21474837' }, { page: '1e2' }, { page: ['1', '2'] }, { limit: '101' }, { limit: '' }, { unexpected: true }]) {
      assert.ok(validateSync(plainToInstance(InventoryReadQueryDto, query), options).length > 0);
    }
  });
  it('rejects nested unknown fields and non-integer/absent count quantities', () => {
    const variantId = '12345678-1234-4234-8234-123456789abc';
    for (const body of [{ lines: [] }, { lines: [{ variantId }] }, { lines: [{ variantId, countedQuantity: null }] }, { lines: [{ variantId, countedQuantity: true }] }, { lines: [{ variantId, countedQuantity: -1 }] }, { lines: [{ variantId, countedQuantity: 1, unknown: 'not accepted' }] }]) {
      assert.ok(validateSync(plainToInstance(UpdateInventoryCountLinesDto, body), options).length > 0);
    }
    assert.equal(validateSync(plainToInstance(UpdateInventoryCountLinesDto, { lines: [{ variantId, countedQuantity: 0 }] }), options).length, 0);
  });
  it('denies count/import reads before accessing SQL for an unauthorized actor', async () => {
    const prisma = new Proxy({}, { get: () => { throw new Error('Unauthorized SQL access'); } }) as InventoryOperationReadRepository;
    const actor = { sub: 'viewer', permissions: ['inventory.read'] } as CurrentUser;
    for (const service of [new GetInventoryCountSessionsUseCase(prisma), new GetInventoryImportsUseCase(prisma)]) {
      await assert.rejects(service.list(actor, new InventoryReadQueryDto()), { status: 403 });
      await assert.rejects(service.get(actor, '12345678-1234-4234-8234-123456789abc'), { status: 403 });
    }
  });
});
