import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';
import { AuthPolicyService } from 'src/modules/auth/domain/services/auth-policy.service';

describe('AuthPolicyService', () => {
  it('returns the same invalid-credentials response for an inactive account', async () => {
    const user = AdminUserEntity.fromState({
      id: 'user-id', email: 'inactive@example.test', fullName: 'Inactive',
      role: { id: 'role-id', slug: 'admin', name: 'Admin', permissions: [] },
      passwordHash: '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      isActive: false, twoFactorSecret: null,
    });

    await assert.rejects(
      () => new AuthPolicyService().verifyPassword(user, 'some-password'),
      (error: unknown) => {
        assert.equal((error as { status?: number }).status, 401);
        assert.equal((error as Error).message, 'Invalid credentials');
        return true;
      },
    );
  });
});
