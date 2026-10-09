import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetAdminReportsUseCase } from 'src/modules/analytics/application/use-cases/get-admin-reports.use-case';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

const actor = { permissions: ['reports.read'] } as CurrentUser;

function withReadTransaction(database: object): PrismaService {
  return {
    ...database,
    async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
      return callback(database);
    },
  } as unknown as PrismaService;
}

describe('GetAdminReportsUseCase request bounds', () => {
  it('rejects unsupported filters before issuing database queries', async () => {
    let queryCount = 0;
    const model = new Proxy({}, {
      get() {
        return async () => { queryCount += 1; return []; };
      },
    });
    const useCase = new GetAdminReportsUseCase({
      order: model,
      product: model,
      notification: model,
      auditLog: model,
      shipment: model,
    } as unknown as PrismaService);

    await assert.rejects(
      useCase.execute(actor, { range: 'all-time' }),
      (error) => error instanceof BadRequestException,
    );
    assert.equal(queryCount, 0);
  });

  it('bounds materialized source rows and fails closed instead of returning partial totals', async () => {
    let orderQuery: { take?: number; orderBy?: unknown } | undefined;
    const emptyModel = {
      async findMany() { return []; },
      async groupBy() { return []; },
      async count() { return 0; },
    };
    const prisma = withReadTransaction({
      order: {
        async count() { return 0; },
        async findMany(args: { take?: number; orderBy?: unknown }) {
          orderQuery = args;
          return Array.from({ length: (args.take ?? 0) }, () => ({}));
        },
      },
      product: emptyModel,
      orderItem: emptyModel,
      payment: emptyModel,
      inventoryItem: emptyModel,
      variant: emptyModel,
      notification: emptyModel,
      auditLog: emptyModel,
      shipment: emptyModel,
    });
    const useCase = new GetAdminReportsUseCase(prisma);

    await assert.rejects(
      useCase.execute(actor),
      (error) => error instanceof PayloadTooLargeException,
    );
    assert.equal(orderQuery?.take, 5001);
    assert.deepEqual(orderQuery?.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('bounds nested order relations and rejects truncated relation data', async () => {
    type BoundQuery = {
      take?: number;
      orderBy?: unknown;
      select?: {
        orderItems?: { take?: number };
        payments?: { take?: number };
        shipments?: { take?: number };
      };
    };
    let orderQuery: BoundQuery | undefined;
    const emptyModel = {
      async findMany() { return []; },
      async groupBy() { return []; },
      async count() { return 0; },
    };
    const prisma = withReadTransaction({
      order: {
        async count() { return 0; },
        async findMany(args: BoundQuery) {
          orderQuery = args;
          return [{
            id: 'order-1', orderNumber: 'ORD-1', status: 'pending', grandTotal: 1, createdAt: new Date(),
            orderItems: [], payments: Array.from({ length: args.select?.payments?.take ?? 0 }, () => ({})), shipments: [],
          }];
        },
      },
      product: emptyModel,
      orderItem: emptyModel,
      payment: emptyModel,
      inventoryItem: emptyModel,
      variant: emptyModel,
      notification: emptyModel,
      auditLog: emptyModel,
      shipment: emptyModel,
    });
    const useCase = new GetAdminReportsUseCase(prisma);

    await assert.rejects(
      useCase.execute(actor),
      (error) => error instanceof PayloadTooLargeException,
    );
    assert.equal(orderQuery?.select?.orderItems?.take, 21);
    assert.equal(orderQuery?.select?.payments?.take, 11);
    assert.equal(orderQuery?.select?.shipments?.take, 11);
  });

  it('rejects an over-budget total before materializing root report rows', async () => {
    let materialized = false;
    const emptyModel = {
      async findMany() { return []; },
      async groupBy() { return []; },
      async count() { return 0; },
    };
    const prisma = withReadTransaction({
      order: {
        async count() { return 0; },
        async findMany() { materialized = true; return []; },
      },
      orderItem: { async count() { return 50001; } },
      product: emptyModel,
      payment: emptyModel,
      inventoryItem: emptyModel,
      variant: emptyModel,
      notification: emptyModel,
      auditLog: emptyModel,
      shipment: emptyModel,
    });
    const useCase = new GetAdminReportsUseCase(prisma);

    await assert.rejects(
      useCase.execute(actor),
      (error) => error instanceof PayloadTooLargeException,
    );
    assert.equal(materialized, false);
  });
});
