import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PayloadTooLargeException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetAdminDashboardUseCase } from 'src/modules/analytics/application/use-cases/get-admin-dashboard.use-case';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('GetAdminDashboardUseCase relation bounds', () => {
  it('caps and rejects an oversized per-order relation instead of returning partial metrics', async () => {
    let queryTake: number | undefined;
    const database = {
      order: {
        async findMany(args: { include?: { orderItems?: { take?: number } } }) {
          if (args.include?.orderItems) {
            queryTake = args.include.orderItems.take;
            return [{ orderItems: Array.from({ length: queryTake ?? 0 }), payments: [], shipments: [] }];
          }
          return [];
        },
        async count() { return 0; },
      },
      orderItem: { async count() { return 0; } },
      payment: { async count() { return 0; }, async findMany() { return []; } },
      shipment: { async count() { return 0; }, async findMany() { return []; } },
      variant: { async count() { return 0; } },
      inventoryItem: { async count() { return 0; } },
      product: { async count() { return 0; }, async findMany() { return []; } },
      customer: { async count() { return 0; } },
      notification: { async groupBy() { return []; }, async findMany() { return []; } },
      auditLog: { async findMany() { return []; }, async count() { return 0; } },
    };
    const prisma = {
      ...database,
      async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
        return callback(database);
      },
    } as unknown as PrismaService;
    const useCase = new GetAdminDashboardUseCase(prisma);

    await assert.rejects(
      useCase.execute({ permissions: ['dashboard.read'] } as CurrentUser),
      (error) => error instanceof PayloadTooLargeException,
    );
    assert.equal(queryTake, 21);
  });
});
