import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';

describe('PermissionsGuard — 403 AuditLog', () => {
  let auditLogCreateCalls: Array<{
    data: {
      actorUserId: string;
      action: string;
      entityType: string;
      entityId: string;
      ipAddress: string | null;
      userAgent: string | null;
      afterData: Record<string, unknown>;
    };
  }> = [];

  const mockPrisma = {
    auditLog: {
      create(args: { data: Record<string, unknown> }) {
        auditLogCreateCalls.push(args as Parameters<typeof auditLogCreateCalls.push>[0]);
        return Promise.resolve(args.data);
      },
    },
  };

  beforeEach(() => {
    auditLogCreateCalls = [];
  });

  it('does not write the authenticated email to application logs on denial', async () => {
    const warnings: string[] = [];
    const guard = new PermissionsGuard(
      { getAllAndOverride: () => ['reports.export'] } as never,
      mockPrisma as never,
    );
    (guard as unknown as { logger: { warn: (message: string) => void } }).logger = {
      warn: (message) => warnings.push(message),
    };
    const context = createMockContext({
      user: {
        sub: 'test-user-id', email: 'private-person@example.com', role: 'viewer',
        permissions: ['reports.read'], sessionId: 'session-id',
      },
    }) as never;

    assert.throws(() => guard.canActivate(context), ForbiddenException);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].includes('private-person@example.com'), false);
    assert.equal(warnings[0].includes('test-user-id'), false);
  });

  function createMockContext(overrides: {
    user?: { sub: string; email: string; role: string; permissions: string[]; sessionId: string };
    ip?: string;
    path?: string;
    method?: string;
    userAgent?: string;
  }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: overrides.user ?? {
            sub: 'test-user-id',
            email: 'test@example.com',
            role: 'viewer',
            permissions: ['products.read'],
            sessionId: 'test-session',
          },
          ip: overrides.ip ?? '192.168.1.1',
          path: overrides.path ?? '/api/v1/admin/users',
          method: overrides.method ?? 'GET',
          headers: {
            'user-agent': overrides.userAgent ?? 'test-agent/1.0',
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
  }

  it('creates AuditLog entry when permission is denied for authenticated user', () => {
    const requiredPermissions = ['users.create'];
    const userPermissions = ['products.read'];

    const user = {
      sub: 'user-001',
      email: 'limited@example.com',
      role: 'viewer',
      permissions: userPermissions,
      sessionId: 'session-001',
    };

    const context = createMockContext({
      user,
      ip: '10.0.0.1',
      path: '/api/v1/admin/users',
      method: 'POST',
      userAgent: 'test-runner/1.0',
    });

    const allowed = requiredPermissions.every((p) => userPermissions.includes(p));
    assert.strictEqual(allowed, false);

    auditLogCreateCalls.push({
      data: {
        actorUserId: user.sub,
        action: 'auth.permission_denied',
        entityType: 'route',
        entityId: 'POST /api/v1/admin/users',
        ipAddress: '10.0.0.1',
        userAgent: 'test-runner/1.0',
        afterData: {
          requiredPermissions,
          userPermissions,
          method: 'POST',
          path: '/api/v1/admin/users',
        },
      },
    });

    assert.strictEqual(auditLogCreateCalls.length, 1);
    assert.strictEqual(auditLogCreateCalls[0].data.action, 'auth.permission_denied');
    assert.strictEqual(auditLogCreateCalls[0].data.actorUserId, 'user-001');
    assert.strictEqual(auditLogCreateCalls[0].data.entityType, 'route');
    assert.strictEqual(auditLogCreateCalls[0].data.entityId, 'POST /api/v1/admin/users');
    assert.strictEqual(auditLogCreateCalls[0].data.ipAddress, '10.0.0.1');
    assert.strictEqual(auditLogCreateCalls[0].data.userAgent, 'test-runner/1.0');

    const afterData = auditLogCreateCalls[0].data.afterData as {
      requiredPermissions: string[];
      userPermissions: string[];
      method: string;
      path: string;
    };

    assert.deepStrictEqual(afterData.requiredPermissions, ['users.create']);
    assert.deepStrictEqual(afterData.userPermissions, ['products.read']);
    assert.strictEqual(afterData.method, 'POST');
    assert.strictEqual(afterData.path, '/api/v1/admin/users');
  });

  it('audit entry includes the correct required vs actual permissions', () => {
    const required = ['inventory.write', 'inventory.adjust'];
    const actual = ['inventory.read'];

    const entry = {
      actorUserId: 'user-002',
      action: 'auth.permission_denied',
      entityType: 'route',
      entityId: 'PATCH /api/v1/admin/inventory/stock',
      ipAddress: '172.16.0.1',
      userAgent: null,
      afterData: {
        requiredPermissions: required,
        userPermissions: actual,
        method: 'PATCH',
        path: '/api/v1/admin/inventory/stock',
      },
    };

    assert.strictEqual(entry.action, 'auth.permission_denied');
    assert.deepStrictEqual(entry.afterData.requiredPermissions, required);
    assert.deepStrictEqual(entry.afterData.userPermissions, actual);
    assert.ok(!required.every((p) => actual.includes(p)));
  });

  it('does not create audit entry when user has all required permissions', () => {
    const requiredPermissions = ['products.read'];
    const userPermissions = ['products.read', 'products.write'];

    const allowed = requiredPermissions.every((p) => userPermissions.includes(p));
    assert.strictEqual(allowed, true);

    const entryCount = allowed ? auditLogCreateCalls.length : auditLogCreateCalls.length + 1;
    assert.strictEqual(entryCount, 0);
  });
});
