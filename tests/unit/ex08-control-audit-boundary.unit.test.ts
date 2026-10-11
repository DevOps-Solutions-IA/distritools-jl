import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetAdminReportsUseCase } from 'src/modules/analytics/application/use-cases/get-admin-reports.use-case';
import { GetAdminDashboardUseCase } from 'src/modules/analytics/application/use-cases/get-admin-dashboard.use-case';

function actor(permissions: string[]) {
  return { sub: 'operator', email: 'operator@example.test', role: 'viewer', permissions } as CurrentUser;
}
function fixture() {
  let reads = 0;
  const audit = { id: 'audit', action: 'synthetic.protected.action', entityType: 'protected_record', entityId: 'private-reference', createdAt: new Date(), actor: { email: 'auditor@example.test' } };
  const base = { count: async () => 0, findMany: async () => [], groupBy: async () => [] };
  const tx = {
    order: base, orderItem: base, payment: base, shipment: base, product: base,
    variant: base, inventoryItem: base, customer: base, notification: base,
    auditLog: { findMany: async () => { reads++; return [audit]; }, count: async () => { reads++; return 1; } },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
  return { reports: new GetAdminReportsUseCase(prisma), dashboard: new GetAdminDashboardUseCase(prisma), reads: () => reads };
}
describe('Existing audit authority across operational projections', () => {
  it('summary denies protected audit rows and counts explicitly without reading the audit source', async () => {
    const f = fixture();
    const result = await f.reports.execute(actor(['reports.read']), { range: 'today' });
    const audit = result.reports.audit as unknown as Record<string, unknown>;
    assert.equal(audit.accessStatus, 'NO_PERMISSION');
    assert.deepEqual(audit.rows, []); assert.deepEqual(audit.chart, []);
    assert.deepEqual(audit.kpis, { auditEvents: 'NO_PERMISSION', reportsExports: 'NO_PERMISSION' });
    assert.equal(audit.empty, false); assert.equal(f.reads(), 0);
    assert.equal(JSON.stringify(result).includes('private-reference'), false);
  });
  it('dashboard denies audit activity and count without querying audit tables', async () => {
    const f = fixture(); const result = await f.dashboard.execute(actor(['dashboard.read']), 'today');
    assert.equal((result.recentActivity as unknown as Record<string, unknown>).auditAccessStatus, 'NO_PERMISSION');
    assert.deepEqual(result.recentActivity.audit, []);
    assert.equal(result.kpis.system.lastAuditEventsCount, 'NO_PERMISSION');
    assert.equal(f.reads(), 0);
    assert.equal(JSON.stringify(result).includes('synthetic.protected.action'), false);
  });
  it('audit.read retains real masked report rows and counts', async () => {
    const f = fixture(); const result = await f.reports.execute(actor(['reports.read', 'audit.read']), { range: 'today' });
    assert.equal((result.reports.audit as unknown as Record<string, unknown>).accessStatus, 'GRANTED');
    assert.equal(result.reports.audit.rows.length, 1);
    assert.equal(result.reports.audit.kpis.auditEvents, 1);
    assert.notEqual(result.reports.audit.rows[0].actor, 'auditor@example.test');
    assert.equal(f.reads(), 1);
  });
  it('audit.read retains dashboard activity and count', async () => {
    const f = fixture(); const result = await f.dashboard.execute(actor(['dashboard.read', 'audit.read']), 'today');
    assert.equal((result.recentActivity as unknown as Record<string, unknown>).auditAccessStatus, 'GRANTED');
    assert.equal(result.recentActivity.audit.length, 1);
    assert.equal(result.kpis.system.lastAuditEventsCount, 1); assert.equal(f.reads(), 2);
  });
  it('audit.export preserves its existing independent authority without granting summary audit.read', async () => {
    const f = fixture(); const user = actor(['reports.read', 'reports.export', 'audit.export']);
    const exportResult = await f.reports.buildExport(user, { type: 'audit', range: 'today' });
    assert.equal(exportResult.rows.length, 1); assert.equal(exportResult.rows[0].entityId, 'private-reference');
    const summary = await f.reports.execute(user, { range: 'today' });
    assert.deepEqual(summary.reports.audit.rows, []);
    assert.equal(f.reads(), 1);
  });
  it('audit.read cannot replace the existing audit.export prerequisite', async () => {
    const f = fixture(); await assert.rejects(f.reports.buildExport(actor(['reports.read', 'reports.export', 'audit.read']), { type: 'audit' }), /audit.export/);
    assert.equal(f.reads(), 0);
  });
});
