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
          password: 'raw-password',
          authorization: 'Bearer raw-access-token',
          cookie: 'refresh=raw-refresh-token',
          otp: '123456',
          recoveryCode: 'recovery-secret',
          apiKey: 'provider-api-key',
          providerPayload: { authorization: 'Bearer provider-token' },
          rawBody: '{"customerEmail":"private@example.com"}',
          customerEmail: 'private@example.com',
          phone: '+573005557733',
          shippingAddress: 'Calle 10 # 20-30',
          documentNumber: '900123456',
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
      password: '[REDACTED]',
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      otp: '[REDACTED]',
      recoveryCode: '[REDACTED]',
      apiKey: '[REDACTED]',
      providerPayload: '[REDACTED]',
      rawBody: '[REDACTED]',
      customerEmail: '[REDACTED]',
      phone: '[REDACTED]',
      shippingAddress: '[REDACTED]',
      documentNumber: '[REDACTED]',
    });
  });

  it('redacts PII in historical audit data when it is read', async () => {
    const record = {
      id: 'audit-test',
      actorUserId: null,
      action: 'legacy.test',
      entityType: 'customer',
      entityId: 'customer-test',
      requestId: null,
      correlationId: null,
      beforeData: null,
      afterData: { nested: { email: 'legacy@example.com', address: 'Calle 9 # 1-2' } },
      ipAddress: null,
      userAgent: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    const repository = new PrismaAuditRepository(
      { auditLog: { async findUnique() { return record; } } } as unknown as PrismaService,
      new RequestContextService(),
    );

    const response = await repository.findById('audit-test');

    assert.deepEqual(response?.afterData, {
      nested: { email: '[REDACTED]', address: '[REDACTED]' },
    });
  });
});
