import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaCancelOrderUnitOfWork } from 'src/modules/orders/infrastructure/transactions/prisma-cancel-order-unit-of-work';

describe('PrismaCancelOrderUnitOfWork', () => {
  it('delegates once with the transaction context and returns the operation result', async () => {
    const transactionContext = { marker: 'cancel-transaction-context' };
    let transactionCalls = 0;
    const prisma = {
      $transaction: async <T>(operation: (tx: typeof transactionContext) => Promise<T>) => {
        transactionCalls += 1;
        return operation(transactionContext);
      },
    } as unknown as PrismaService;
    const unitOfWork = new PrismaCancelOrderUnitOfWork(prisma);
    let receivedContext: unknown;

    const result = await unitOfWork.run(async (tx) => {
      receivedContext = tx;
      return 'order-cancelled';
    });

    assert.equal(transactionCalls, 1);
    assert.strictEqual(receivedContext, transactionContext);
    assert.equal(result, 'order-cancelled');
  });

  it('propagates transaction operation failures unchanged', async () => {
    const expectedError = new Error('cancellation transaction failed');
    const prisma = {
      $transaction: async <T>(operation: (tx: object) => Promise<T>) =>
        operation({ marker: 'cancel-transaction-context' }),
    } as unknown as PrismaService;
    const unitOfWork = new PrismaCancelOrderUnitOfWork(prisma);

    await assert.rejects(
      unitOfWork.run(async () => {
        throw expectedError;
      }),
      (error: unknown) => error === expectedError,
    );
  });
});
