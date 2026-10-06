import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PrismaPaymentWebhookUnitOfWork } from 'src/modules/payments/infrastructure/transactions/prisma-payment-webhook-unit-of-work';

describe('PrismaPaymentWebhookUnitOfWork', () => {
  it('delegates once with the existing transaction options and returns the operation result', async () => {
    const transactionContext = { marker: 'transaction-context' };
    const options: Array<{ maxWait?: number; timeout?: number } | undefined> = [];
    let transactionCalls = 0;
    const prisma = {
      $transaction: async <T>(
        operation: (tx: typeof transactionContext) => Promise<T>,
        transactionOptions?: { maxWait?: number; timeout?: number },
      ) => {
        transactionCalls += 1;
        options.push(transactionOptions);
        return operation(transactionContext);
      },
    } as unknown as PrismaService;
    const unitOfWork = new PrismaPaymentWebhookUnitOfWork(prisma);
    let receivedContext: unknown;

    const result = await unitOfWork.run(async (tx) => {
      receivedContext = tx;
      return 'webhook-finalized';
    });

    assert.equal(transactionCalls, 1);
    assert.strictEqual(receivedContext, transactionContext);
    assert.equal(result, 'webhook-finalized');
    assert.deepEqual(options, [{ maxWait: 15000, timeout: 30000 }]);
  });

  it('propagates transaction operation failures unchanged', async () => {
    const expectedError = new Error('transaction operation failed');
    const prisma = {
      $transaction: async <T>(operation: (tx: object) => Promise<T>) =>
        operation({ marker: 'transaction-context' }),
    } as unknown as PrismaService;
    const unitOfWork = new PrismaPaymentWebhookUnitOfWork(prisma);

    await assert.rejects(
      unitOfWork.run(async () => {
        throw expectedError;
      }),
      (error: unknown) => error === expectedError,
    );
  });
});
