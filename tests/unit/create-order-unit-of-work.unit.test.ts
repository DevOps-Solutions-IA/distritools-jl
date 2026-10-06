import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaCreateOrderUnitOfWork } from 'src/modules/orders/infrastructure/transactions/prisma-create-order-unit-of-work';

describe('PrismaCreateOrderUnitOfWork', () => {
  it('delegates once with the transaction context and returns the operation result', async () => {
    const transactionContext = { marker: 'order-transaction-context' };
    let transactionCalls = 0;
    const prisma = {
      $transaction: async <T>(operation: (tx: typeof transactionContext) => Promise<T>) => {
        transactionCalls += 1;
        return operation(transactionContext);
      },
    } as unknown as PrismaService;
    const unitOfWork = new PrismaCreateOrderUnitOfWork(prisma);
    let receivedContext: unknown;

    const result = await unitOfWork.run(async (tx) => {
      receivedContext = tx;
      return 'order-and-items-created';
    });

    assert.equal(transactionCalls, 1);
    assert.strictEqual(receivedContext, transactionContext);
    assert.equal(result, 'order-and-items-created');
  });

  it('propagates transaction operation failures unchanged', async () => {
    const expectedError = new Error('order transaction failed');
    const prisma = {
      $transaction: async <T>(operation: (tx: object) => Promise<T>) =>
        operation({ marker: 'order-transaction-context' }),
    } as unknown as PrismaService;
    const unitOfWork = new PrismaCreateOrderUnitOfWork(prisma);

    await assert.rejects(
      unitOfWork.run(async () => {
        throw expectedError;
      }),
      (error: unknown) => error === expectedError,
    );
  });
});
