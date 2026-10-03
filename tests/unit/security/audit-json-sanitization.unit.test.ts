import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';
import { RequestContextService } from 'src/common/request/request-context.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('PrismaAuditRepository JSON sanitization', () => {
  it('serializes Prisma Decimal, Date and bigint before writing audit JSON', async () => {
    let captured: Record<string, unknown> | undefined;

    const prismaMock = {
      auditLog: {
        async create(args: { data: Record<string, unknown> }) {
          captured = args.data;
          return args.data;
        },
      },
    };

    const repository = new PrismaAuditRepository(
      prismaMock as unknown as PrismaService,
      new RequestContextService(),
    );

    await repository.write({
      actorUserId: 'user-test',
      action: 'inventory.settings_updated',
      entityType: 'inventory_item',
      entityId: 'variant:warehouse',
      afterData: {
        costPrice: new Prisma.Decimal('120000.50'),
        occurredAt: new Date('2026-10-02T12:00:00.000Z'),
        sequence: 42n,
        nested: {
          integrationToken: 'must-not-leak',
        },
      },
    });

    assert.ok(captured);

    const afterData = captured.afterData as Record<string, unknown>;

    assert.equal(afterData.costPrice, '120000.5');
    assert.equal(afterData.occurredAt, '2026-10-02T12:00:00.000Z');
    assert.equal(afterData.sequence, '42');

    assert.deepEqual(afterData.nested, {
      integrationToken: '[REDACTED]',
    });
  });
});
