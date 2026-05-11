import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { generateSecret } from 'otplib';
import { compare, hash } from 'bcrypt';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
} from 'tests/helpers/test-db';

const execFileAsync = promisify(execFile);

function securePassword(): string {
  return `Aa1!${randomUUID()}Zz9?`;
}

async function runScript(
  scriptPath: string,
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(
    'node',
    ['--import', 'tsx', scriptPath],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function runScriptExpectFailure(
  scriptPath: string,
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string }> {
  try {
    await runScript(scriptPath, env);
  } catch (error: unknown) {
    const failure = error as { stdout?: string; stderr?: string };
    return {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }

  throw new Error('El script debía fallar.');
}

describe('Secure admin credential bootstrap', async () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    await disconnectDatabase();
  });

  await it('creates the first SUPER_ADMIN with hashed password, full permissions and no password output', async () => {
    const password = securePassword();
    const twoFactorSecret = generateSecret();

    const result = await runScript('scripts/admin-bootstrap.ts', {
      ADMIN_BOOTSTRAP_EMAIL: 'secure-admin@distritools.local',
      ADMIN_BOOTSTRAP_PASSWORD: password,
      ADMIN_BOOTSTRAP_PASSWORD_CONFIRM: password,
      ADMIN_BOOTSTRAP_REQUIRE_2FA: 'true',
      ADMIN_BOOTSTRAP_TOTP_SECRET: twoFactorSecret,
    });

    assert.equal(result.stdout.includes(password), false);
    assert.equal(result.stderr.includes(password), false);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'secure-admin@distritools.local' },
      include: {
        role: {
          include: {
            rolePermissions: true,
          },
        },
      },
    });

    assert.equal(user.role.slug, 'super-admin');
    assert.equal(user.isActive, true);
    assert.equal(Boolean(user.twoFactorSecret), true);
    assert.equal(await compare(password, user.passwordHash), true);
    assert.notEqual(user.passwordHash, password);
    assert.equal(user.role.rolePermissions.length >= 30, true);
  });

  await it('does not create duplicate active SUPER_ADMIN users without explicit force', async () => {
    const password = securePassword();
    const twoFactorSecret = generateSecret();
    const env = {
      ADMIN_BOOTSTRAP_EMAIL: 'secure-admin@distritools.local',
      ADMIN_BOOTSTRAP_PASSWORD: password,
      ADMIN_BOOTSTRAP_PASSWORD_CONFIRM: password,
      ADMIN_BOOTSTRAP_REQUIRE_2FA: 'true',
      ADMIN_BOOTSTRAP_TOTP_SECRET: twoFactorSecret,
    };

    await runScript('scripts/admin-bootstrap.ts', env);
    const failure = await runScriptExpectFailure('scripts/admin-bootstrap.ts', {
      ...env,
      ADMIN_BOOTSTRAP_EMAIL: 'second-admin@distritools.local',
    });

    assert.equal(failure.stderr.includes(password), false);

    const count = await prisma.user.count({
      where: { role: { slug: 'super-admin' }, isActive: true },
    });

    assert.equal(count, 1);
  });

  await it('bootstrapped admin can complete login with TOTP and RBAC permissions', async () => {
    const password = securePassword();
    const twoFactorSecret = generateSecret();

    await runScript('scripts/admin-bootstrap.ts', {
      ADMIN_BOOTSTRAP_EMAIL: 'secure-admin@distritools.local',
      ADMIN_BOOTSTRAP_PASSWORD: password,
      ADMIN_BOOTSTRAP_PASSWORD_CONFIRM: password,
      ADMIN_BOOTSTRAP_REQUIRE_2FA: 'true',
      ADMIN_BOOTSTRAP_TOTP_SECRET: twoFactorSecret,
    });

    const testApp = await createTestApp();

    try {
      const session = await loginAsAdmin(
        testApp.http,
        'secure-admin@distritools.local',
        password,
        twoFactorSecret,
      );

      assert.ok(session.accessToken);
      assert.equal(session.user.permissions.includes('users.read'), true);
      assert.equal(session.user.permissions.includes('products.manage'), true);
    } finally {
      await testApp.app.close();
    }
  });

  await it('reset password revokes previous sessions and does not print password', async () => {
    const password = securePassword();
    const newPassword = securePassword();
    const twoFactorSecret = generateSecret();

    await runScript('scripts/admin-bootstrap.ts', {
      ADMIN_BOOTSTRAP_EMAIL: 'secure-admin@distritools.local',
      ADMIN_BOOTSTRAP_PASSWORD: password,
      ADMIN_BOOTSTRAP_PASSWORD_CONFIRM: password,
      ADMIN_BOOTSTRAP_REQUIRE_2FA: 'true',
      ADMIN_BOOTSTRAP_TOTP_SECRET: twoFactorSecret,
    });

    const testApp = await createTestApp();

    try {
      const session = await loginAsAdmin(
        testApp.http,
        'secure-admin@distritools.local',
        password,
        twoFactorSecret,
      );

      const reset = await runScript('scripts/admin-reset-password.ts', {
        ADMIN_RESET_EMAIL: 'secure-admin@distritools.local',
        ADMIN_RESET_PASSWORD: newPassword,
        ADMIN_RESET_PASSWORD_CONFIRM: newPassword,
      });

      assert.equal(reset.stdout.includes(newPassword), false);
      assert.equal(reset.stderr.includes(newPassword), false);

      const activeSessions = await prisma.authSession.count({
        where: {
          user: { email: 'secure-admin@distritools.local' },
          revokedAt: null,
        },
      });
      assert.equal(activeSessions, 0);

      const refresh = await testApp.http.post('/api/v1/auth/refresh').send({
        refreshToken: session.refreshToken,
      });
      assert.equal(refresh.status, 401);
    } finally {
      await testApp.app.close();
    }
  });

  await it('reset 2FA revokes sessions and stores setup secret only in a protected local file', async () => {
    const password = securePassword();
    const twoFactorSecret = generateSecret();
    const nextTwoFactorSecret = generateSecret();

    await runScript('scripts/admin-bootstrap.ts', {
      ADMIN_BOOTSTRAP_EMAIL: 'secure-admin@distritools.local',
      ADMIN_BOOTSTRAP_PASSWORD: password,
      ADMIN_BOOTSTRAP_PASSWORD_CONFIRM: password,
      ADMIN_BOOTSTRAP_REQUIRE_2FA: 'true',
      ADMIN_BOOTSTRAP_TOTP_SECRET: twoFactorSecret,
    });

    const testApp = await createTestApp();

    try {
      await loginAsAdmin(
        testApp.http,
        'secure-admin@distritools.local',
        password,
        twoFactorSecret,
      );

      const reset = await runScript('scripts/admin-reset-2fa.ts', {
        ADMIN_RESET_EMAIL: 'secure-admin@distritools.local',
        ADMIN_RESET_TOTP_SECRET: nextTwoFactorSecret,
      });

      assert.equal(reset.stdout.includes(nextTwoFactorSecret), false);
      assert.equal(reset.stderr.includes(nextTwoFactorSecret), false);

      const match = reset.stdout.match(/Archivo local 2FA creado con permisos 0600: (.+)/);
      assert.ok(match?.[1]);
      const filePath = match[1].trim();
      const mode = fs.statSync(filePath).mode & 0o777;
      assert.equal(mode, 0o600);

      const activeSessions = await prisma.authSession.count({
        where: {
          user: { email: 'secure-admin@distritools.local' },
          revokedAt: null,
        },
      });
      assert.equal(activeSessions, 0);

      const session = await loginAsAdmin(
        testApp.http,
        'secure-admin@distritools.local',
        password,
        nextTwoFactorSecret,
      );
      assert.ok(session.accessToken);
    } finally {
      await testApp.app.close();
    }
  });

  await it('rejects users without required permissions', async () => {
    const password = securePassword();
    const twoFactorSecret = generateSecret();
    const role = await prisma.role.create({
      data: {
        id: randomUUID(),
        name: 'No Permissions',
        slug: 'no-permissions',
      },
    });

    await prisma.user.create({
      data: {
        id: randomUUID(),
        fullName: 'No Permission User',
        email: 'no-permission@distritools.local',
        passwordHash: await hash(password, 12),
        roleId: role.id,
        isActive: true,
        twoFactorSecret,
      },
    });

    const testApp = await createTestApp();

    try {
      const session = await loginAsAdmin(
        testApp.http,
        'no-permission@distritools.local',
        password,
        twoFactorSecret,
      );
      const response = await testApp.http
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${session.accessToken}`);

      assert.equal(response.status, 403);
    } finally {
      await testApp.app.close();
    }
  });

  await it('blocks unsafe production bootstrap defaults', async () => {
    const password = securePassword();
    const failure = await runScriptExpectFailure('scripts/admin-bootstrap.ts', {
      NODE_ENV: 'production',
      ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
      ADMIN_BOOTSTRAP_PASSWORD: password,
      ADMIN_BOOTSTRAP_PASSWORD_CONFIRM: password,
      ADMIN_BOOTSTRAP_REQUIRE_2FA: 'true',
      ADMIN_BOOTSTRAP_TOTP_SECRET: generateSecret(),
    });

    assert.match(failure.stderr, /CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP/);
  });
});
