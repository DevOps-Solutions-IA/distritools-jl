import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminSessionController } from '../../src/modules/auth/infrastructure/http/controllers/admin-session.controller';
import { CurrentUser } from '../../src/common/interfaces/current-user.interface';

describe('EX-08 session context projection', () => {
  it('exposes only the verified actor identity and effective permissions', () => {
    const actor = {
      sub: 'verified-actor', email: 'actor@example.test', role: 'viewer',
      permissions: ['inventory.read'], sessionId: 'private-session',
      id: 'untrusted-alternate-id', passwordHash: 'private-hash',
      accessToken: 'private-token', twoFactorSecret: 'private-seed',
    };
    const response = new AdminSessionController().session(actor);
    assert.deepEqual(response, { user: {
      id: 'verified-actor', email: 'actor@example.test', role: 'viewer',
      permissions: ['inventory.read'],
    } });
  });

  it('returns a permission snapshot without mutating the verified actor', () => {
    const actor: CurrentUser = {
      sub: 'actor', email: 'actor@example.test', role: 'viewer',
      permissions: [], sessionId: 'private-session',
    };
    const response = new AdminSessionController().session(actor);
    response.user.permissions.push('users.read');
    assert.deepEqual(actor.permissions, []);
    assert.deepEqual(new AdminSessionController().session(actor).user.permissions, []);
  });
});
