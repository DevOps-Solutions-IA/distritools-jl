import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { GetOperationalMetricsUseCase } from 'src/modules/analytics/application/use-cases/get-operational-metrics.use-case';
import { AnalyticsRepository } from 'src/modules/analytics/domain/repositories/analytics.repository';

function fixture(auditFailure = false) {
  let auditQueries = 0;
  const analytics = {
    async getOrderStatusCounts() { return { paid: 2, draft: 1 }; },
    async getPaymentStatusCounts() { return { approved: 2 }; },
    async getInventoryStatus() { return { lowStock: 3, totalTracked: 7 }; },
    async getSalesSummary() { return { netRevenue: '50.00', orderCount: 2 }; },
  } as AnalyticsRepository;
  const prisma = {
    product: { async findMany() { return []; } },
    order: { async findMany() { return []; } },
    customer: { async count() { return 8; } },
    notification: { async groupBy() { return []; } },
    shipment: { async findMany() { return []; } },
    stockMovement: { async count() { return 9; } },
    auditLog: {
      async count() {
        auditQueries++;
        if (auditFailure) throw new Error('audit source unavailable');
        return 11;
      },
    },
  } as unknown as PrismaService;
  return { useCase: new GetOperationalMetricsUseCase(analytics, prisma), queries: () => auditQueries };
}

const actor = (permissions: string[]) => ({ permissions } as CurrentUser);

describe('Legacy operational audit count authority', () => {
  it('denies the audit count without touching its source when audit.read is absent', async () => {
    const f = fixture();
    const result = await f.useCase.execute(actor(['dashboard.read']));
    assert.equal(result.executive.auditEventsCount, 'NO_PERMISSION');
    assert.equal(result.executive.auditAccessStatus, 'NO_PERMISSION');
    assert.equal(f.queries(), 0);
    assert.equal(result.executive.orderCount, 2);
    assert.equal(result.executive.customersCount, 8);
    assert.equal(result.executive.stockMovementsCount, 9);
  });

  it('does not treat audit.export as audit.read', async () => {
    const f = fixture();
    const result = await f.useCase.execute(actor(['dashboard.read', 'audit.export']));
    assert.equal(result.executive.auditEventsCount, 'NO_PERMISSION');
    assert.equal(result.executive.auditAccessStatus, 'NO_PERMISSION');
    assert.equal(f.queries(), 0);
  });

  it('returns the real count for audit.read and preserves every other metric', async () => {
    const f = fixture();
    const allowed = await f.useCase.execute(actor(['dashboard.read', 'audit.read']));
    const denied = await f.useCase.execute(actor(['dashboard.read']));
    assert.equal(allowed.executive.auditEventsCount, 11);
    assert.equal(allowed.executive.auditAccessStatus, 'GRANTED');
    assert.equal(f.queries(), 1);
    assert.deepEqual(
      { ...allowed, executive: { ...allowed.executive, auditEventsCount: null, auditAccessStatus: null } },
      { ...denied, executive: { ...denied.executive, auditEventsCount: null, auditAccessStatus: null } },
    );
  });

  it('fails closed before querying audit when dashboard.read is absent', async () => {
    const f = fixture();
    await assert.rejects(f.useCase.execute(actor(['audit.read'])), ForbiddenException);
    assert.equal(f.queries(), 0);
  });

  it('keeps denied metrics available even if the forbidden audit source would fail', async () => {
    const f = fixture(true);
    const result = await f.useCase.execute(actor(['dashboard.read']));
    assert.equal(result.executive.auditEventsCount, 'NO_PERMISSION');
    assert.equal(result.executive.auditAccessStatus, 'NO_PERMISSION');
    assert.equal(f.queries(), 0);
  });

  it('propagates a real authorized audit failure instead of substituting zero', async () => {
    const f = fixture(true);
    await assert.rejects(f.useCase.execute(actor(['dashboard.read', 'audit.read'])), /audit source unavailable/);
    assert.equal(f.queries(), 1);
  });
});
