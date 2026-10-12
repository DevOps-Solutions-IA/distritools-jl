import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

const actor = { sub: '00000000-0000-4000-8000-000000000001', permissions: ['payments.read'] } as CurrentUser;
function controller() {
  const database = { payment: { async count() { return 1; }, async findMany() { return [{ id:'p1',orderId:'00000000-0000-4000-8000-000000000002',order:{orderNumber:'SYNTHETIC'},gateway:'cash_on_delivery',status:'pending',amount:new Prisma.Decimal(120),currency:'COP',gatewayReference:'private-reference',createdAt:new Date(),updatedAt:new Date() }]; } } };
  return new AdminOperationsController(database as unknown as PrismaService, {} as AuditRepository);
}
describe('EX08 SALE payment query and canonical cancellation boundaries', () => {
  it('rejects malformed and repeated orderId filters before querying the database', async () => {
    for (const orderId of ['', 'not-a-uuid', ['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'], { id:'x' }]) {
      await assert.rejects(controller().listPayments({orderId} as Parameters<AdminOperationsController['listPayments']>[0], actor), BadRequestException);
    }
  });
  it('preserves finance masking on order-filtered payments and actual authorized values', async () => {
    const query = {orderId:'00000000-0000-4000-8000-000000000002'};
    const masked = await controller().listPayments(query,actor);
    assert.equal(masked.data[0].amount,'NO_PERMISSION');assert.equal(masked.data[0].providerReference,'[PROTECTED]');
    const allowed = await controller().listPayments(query,{...actor,permissions:[...actor.permissions,'reports.financial.read']});
    assert.equal(allowed.data[0].amount,'120.00');assert.equal(allowed.data[0].providerReference,'private-reference');
  });
  it('does not retain the shadowed unsafe order-ID cancellation handler', () => {
    assert.equal(Object.getOwnPropertyNames(AdminOperationsController.prototype).includes('cancelOrderById'),false);
  });
});
