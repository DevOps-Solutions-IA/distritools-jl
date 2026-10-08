import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaAuthSessionRepository } from 'src/modules/auth/infrastructure/repositories/prisma-auth-session.repository';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('PrismaAuthSessionRepository rotation', () => {
  it('rotates only if the persisted refresh JTI still matches the verified token', async () => {
    let captured: Record<string, unknown> | undefined;
    const repository = new PrismaAuthSessionRepository({
      authSession: {
        async updateMany(args: Record<string, unknown>) {
          captured = args;
          return { count: 1 };
        },
      },
    } as unknown as PrismaService);

    const changed = await repository.rotate(
      'session-id', 'verified-current-jti', 'next-hash', 'next-jti', new Date(Date.now() + 60_000),
    );

    assert.equal(changed, true);
    assert.deepEqual(captured?.where, {
      id: 'session-id', currentJti: 'verified-current-jti', revokedAt: null, compromisedAt: null,
      expiresAt: { gt: (captured?.where as { expiresAt: { gt: Date } }).expiresAt.gt },
    });
    assert.equal((captured?.data as Record<string, unknown>).currentJti, 'next-jti');
  });

  it('reports a lost race without overwriting the winning refresh credential', async () => {
    let captured: Record<string, unknown> | undefined;
    const repository = new PrismaAuthSessionRepository({
      authSession: {
        async updateMany(args: Record<string, unknown>) {
          captured = args;
          return { count: 0 };
        },
      },
    } as unknown as PrismaService);

    const changed = await repository.rotate(
      'session-id', 'stale-jti', 'loser-hash', 'loser-jti', new Date(Date.now() + 60_000),
    );

    assert.equal(changed, false);
    assert.equal((captured?.where as Record<string, unknown>).currentJti, 'stale-jti');
  });
});
