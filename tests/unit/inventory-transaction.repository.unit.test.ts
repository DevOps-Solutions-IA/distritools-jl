import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaInventoryRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory.repository';

describe('PrismaInventoryRepository transaction boundary', () => {
  it('delegates the operation to Prisma transaction and returns its result', async () => {
    const transaction = { marker: 'transaction-client' };
    let calls = 0;
    const prisma = {
      $transaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) => {
        calls += 1;
        return operation(transaction);
      },
    } as unknown as PrismaService;
    const repository = new PrismaInventoryRepository(prisma);
    const result = await repository.withTransaction(async (tx) => tx.marker);

    assert.equal(calls, 1);
    assert.equal(result, 'transaction-client');
  });
});
