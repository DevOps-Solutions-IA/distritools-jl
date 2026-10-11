import 'tests/helpers/test-env';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { generate } from 'otplib';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { createTestApp } from 'tests/helpers/test-app';
import { prisma, resetDatabase, seedBaseData, disconnectDatabase } from 'tests/helpers/test-db';
import { assertDisposableTarget } from 'tests/helpers/ex07-4-disposable-target';

describe('EX-08 authenticated live self-context', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let admin: { accessToken: string; refreshToken: string; challengeToken: string };
  let viewer: typeof admin;
  let persistedSession: Awaited<ReturnType<typeof prisma.authSession.findFirstOrThrow>>;

  async function authenticate(email: string, password: string) {
    const login = await http.post('/api/v1/auth/login').send({ email, password });
    assert.equal(login.status, 201, 'login must succeed before testing the session context');
    assert.equal(typeof login.body.challengeToken, 'string');
    // Prepare one attempt away from the known period boundary; never retry an auth rejection.
    const remaining = 30_000 - (Date.now() % 30_000);
    if (remaining < 2_000) await new Promise((resolve) => setTimeout(resolve, remaining + 50));
    const code = await generate({ secret: seeded.users.twoFactorSecret });
    const verified = await http.post('/api/v1/auth/verify-2fa').send({ challengeToken: login.body.challengeToken, code });
    assert.equal(verified.status, 201, '2FA must succeed before testing the session context');
    assert.ok(typeof verified.body.accessToken === 'string' && verified.body.accessToken.length > 0);
    assert.ok(typeof verified.body.refreshToken === 'string' && verified.body.refreshToken.length > 0);
    return { accessToken: verified.body.accessToken as string, refreshToken: verified.body.refreshToken as string, challengeToken: login.body.challengeToken as string };
  }

  before(async () => {
    assertDisposableTarget();
    assert.equal(process.env.ADMIN_AUTH_DISABLED, 'false');
    await resetDatabase();
    seeded = await seedBaseData();
    const instance = await createTestApp(); app = instance.app; http = instance.http;
    admin = await authenticate(seeded.users.adminEmail, seeded.users.adminPassword);
    viewer = await authenticate(seeded.users.viewerEmail, seeded.users.viewerPassword);
    persistedSession = await prisma.authSession.findFirstOrThrow({ where: { userId: seeded.users.adminUserId } });
  });

  after(async () => {
    if (app) {
      for (const name of ['auth', 'domain-events', 'notifications']) await app.get<Queue>(getQueueToken(name), { strict: false }).waitUntilReady();
      await app.close();
    }
    await disconnectDatabase();
  });

  it('returns only the verified actor context and prevents caching of private identity', async () => {
    const response = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body), ['user']);
    assert.deepEqual(Object.keys(response.body.user).sort(), ['email', 'id', 'permissions', 'role']);
    assert.equal(response.body.user.id, seeded.users.adminUserId);
    assert.equal(response.body.user.email, seeded.users.adminEmail);
    assert.equal(response.body.user.role, 'super-admin');
    assert.ok(response.body.user.permissions.includes('users.read'));
    assert.equal(response.headers['cache-control'], 'private, no-store');
    const serialized = JSON.stringify(response.body);
    for (const sensitive of [admin.accessToken, admin.refreshToken, admin.challengeToken, seeded.users.twoFactorSecret, persistedSession.id, persistedSession.refreshTokenHash, seeded.users.viewerEmail]) {
      assert.equal(serialized.includes(sensitive), false, 'self-context must not contain secrets, session identity or another actor');
    }
  });

  it('allows a viewer without users.read to inspect only its own context despite foreign query inputs', async () => {
    const response = await http.get('/api/v1/admin/session').query({ userId: seeded.users.adminUserId, id: seeded.users.adminUserId, role: 'super-admin', permissions: 'users.read' })
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { user: { id: seeded.users.viewerUserId, email: seeded.users.viewerEmail, role: 'viewer', permissions: ['inventory.read'] } });
    const foreignRoute = await http.get(`/api/v1/admin/session/${seeded.users.adminUserId}`).set('Authorization', `Bearer ${viewer.accessToken}`);
    assert.equal(foreignRoute.status, 404);
  });

  it('does not mutate the actor, session, challenges or business audit during a context read', async () => {
    const snapshot = async () => ({
      user: await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.adminUserId }, select: { id: true, email: true, roleId: true, isActive: true, lastLoginAt: true } }),
      session: await prisma.authSession.findUniqueOrThrow({ where: { id: persistedSession.id }, select: { id: true, expiresAt: true, revokedAt: true, compromisedAt: true, lastUsedAt: true, currentJti: true } }),
      sessions: await prisma.authSession.count(), challenges: await prisma.authTwoFactorChallenge.count(), audits: await prisma.auditLog.count(), orders: await prisma.order.count(),
    });
    const beforeRead = await snapshot();
    const response = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await snapshot(), beforeRead);
  });

  it('reads current persisted permissions and identity after an access token has been issued', async () => {
    const permissions = await prisma.rolePermission.findMany({ where: { roleId: seeded.roles.limitedRoleId } });
    try {
      await prisma.rolePermission.deleteMany({ where: { roleId: seeded.roles.limitedRoleId } });
      await prisma.user.update({ where: { id: seeded.users.viewerUserId }, data: { email: 'session-updated@example.invalid' } });
      const response = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${viewer.accessToken}`);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { user: { id: seeded.users.viewerUserId, email: 'session-updated@example.invalid', role: 'viewer', permissions: [] } });
    } finally {
      await prisma.user.update({ where: { id: seeded.users.viewerUserId }, data: { email: seeded.users.viewerEmail } });
      await prisma.rolePermission.createMany({ data: permissions });
    }
  });

  it('rejects absent, malformed, wrong-signature, wrong-purpose, expired and missing-session tokens', async () => {
    const jwt = app.get(JwtService);
    const claims = { sub: seeded.users.adminUserId, email: seeded.users.adminEmail, role: 'super-admin', sessionId: persistedSession.id };
    const options = { issuer: 'distritoolsjl', audience: 'admin-api', expiresIn: '5m', secret: process.env.JWT_ACCESS_SECRET! };
    assert.equal((await http.get('/api/v1/admin/session')).status, 401);
    const cases = [
      ['malformed', 'not-a-jwt'],
      ['wrong signature', jwt.sign(claims, { ...options, secret: 'synthetic-wrong-signature-only' })],
      ['wrong audience', jwt.sign(claims, { ...options, audience: 'admin-refresh' })],
      ['wrong issuer', jwt.sign(claims, { ...options, issuer: 'another-issuer' })],
      ['expired', jwt.sign(claims, { ...options, expiresIn: -1 })],
      ['2FA challenge purpose', admin.challengeToken],
      ['refresh purpose', admin.refreshToken],
      ['missing persisted session', jwt.sign({ ...claims, sessionId: randomUUID() }, options)],
    ];
    for (const [label, token] of cases) {
      const response = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${token}`);
      assert.equal(response.status, 401, label);
      assert.equal('user' in response.body, false, label);
    }
  });

  for (const field of ['revokedAt', 'compromisedAt', 'expiresAt'] as const) {
    it(`rejects a live access token when its persisted session ${field} denies use`, async () => {
      try {
        await prisma.authSession.update({ where: { id: persistedSession.id }, data: { [field]: new Date(Date.now() - 60_000) } });
        const response = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${admin.accessToken}`);
        assert.equal(response.status, 401);
        assert.equal('user' in response.body, false);
      } finally {
        await prisma.authSession.update({ where: { id: persistedSession.id }, data: { [field]: persistedSession[field] } });
      }
    });
  }

  it('rejects an inactive persisted user even when its access token is still valid', async () => {
    try {
      await prisma.user.update({ where: { id: seeded.users.adminUserId }, data: { isActive: false } });
      const response = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${admin.accessToken}`);
      assert.equal(response.status, 401);
      assert.equal('user' in response.body, false);
    } finally {
      await prisma.user.update({ where: { id: seeded.users.adminUserId }, data: { isActive: true } });
    }
  });
});
