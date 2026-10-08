import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generate } from 'otplib';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  prisma,
  disconnectDatabase,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';
import { PrismaAuthSessionRepository } from 'src/modules/auth/infrastructure/repositories/prisma-auth-session.repository';
import { PrismaTwoFactorChallengeRepository } from 'src/modules/auth/infrastructure/repositories/prisma-two-factor-challenge.repository';

describe('Authentication and RBAC', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;

  async function closeAppAfterQueueConnectionsSettle() {
    for (const queueName of ['auth', 'domain-events', 'notifications']) {
      await app.get<Queue>(getQueueToken(queueName), { strict: false }).waitUntilReady();
    }
    await app.close();
  }

  before(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
  });

  async function resetAppRateLimitState() {
    await closeAppAfterQueueConnectionsSettle();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
  }

  after(async () => {
    await closeAppAfterQueueConnectionsSettle();
    await disconnectDatabase();
  });

  await it('admin login + 2FA + refresh rotation works', async () => {
    const login = await http.post('/api/v1/auth/login').send({
      email: seeded.users.adminEmail,
      password: seeded.users.adminPassword,
    });
    assert.equal(login.status, 201);
    assert.ok(login.body.challengeToken);
    assert.equal(JSON.stringify(login.body).includes(seeded.users.adminPassword), false);

    const session = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);

    const refresh = await http.post('/api/v1/auth/refresh').send({
      refreshToken: session.refreshToken,
    });
    assert.equal(refresh.status, 201);
    assert.ok(refresh.body.accessToken);
    assert.ok(refresh.body.refreshToken);
    assert.notEqual(refresh.body.refreshToken, session.refreshToken);

    const authAudit = await prisma.auditLog.findMany({
      where: { actorUserId: seeded.users.adminUserId, action: { startsWith: 'auth.' } },
      select: { beforeData: true, afterData: true },
    });
    const auditBody = JSON.stringify(authAudit);
    assert.equal(auditBody.includes(seeded.users.adminPassword), false);
    assert.equal(auditBody.includes(session.accessToken), false);
    assert.equal(auditBody.includes(session.refreshToken), false);
  });

  await it('a verified 2FA challenge can only create one session', async () => {
    const login = await http.post('/api/v1/auth/login').send({
      email: seeded.users.adminEmail,
      password: seeded.users.adminPassword,
    });
    assert.equal(login.status, 201);

    const code = await generate({ secret: seeded.users.twoFactorSecret });
    const before = await prisma.authSession.count({
      where: { userId: seeded.users.adminUserId },
    });
    const input = { challengeToken: login.body.challengeToken, code };
    const invalidCode = code === '000000' ? '000001' : '000000';
    const invalid = await http.post('/api/v1/auth/verify-2fa').send({ ...input, code: invalidCode });
    const first = await http.post('/api/v1/auth/verify-2fa').send(input);
    const replay = await http.post('/api/v1/auth/verify-2fa').send(input);
    const after = await prisma.authSession.count({
      where: { userId: seeded.users.adminUserId },
    });

    assert.equal(invalid.status, 401);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 401);
    assert.equal(after - before, 1);
  });

  await it('does not create a session for invalid or expired 2FA challenges', async () => {
    await resetAppRateLimitState();
    const before = await prisma.authSession.count({ where: { userId: seeded.users.adminUserId } });
    const invalid = await http.post('/api/v1/auth/verify-2fa').send({
      challengeToken: 'malformed.challenge.token', code: '000000',
    });
    const jwt = require('jsonwebtoken') as { sign(payload: object, secret: string, options: object): string };
    const expiredChallenge = jwt.sign({
      sub: seeded.users.adminUserId,
      email: seeded.users.adminEmail,
      jti: randomUUID(),
    }, process.env.JWT_2FA_CHALLENGE_SECRET!, {
      issuer: 'distritoolsjl', audience: 'admin-2fa', expiresIn: -1,
    });
    const expired = await http.post('/api/v1/auth/verify-2fa').send({
      challengeToken: expiredChallenge,
      code: await generate({ secret: seeded.users.twoFactorSecret }),
    });
    const after = await prisma.authSession.count({ where: { userId: seeded.users.adminUserId } });
    assert.equal(invalid.status, 401);
    assert.equal(expired.status, 401);
    assert.equal(after, before);
  });

  await it('concurrent refresh rotations have exactly one compare-and-swap winner', async () => {
    const sessionId = randomUUID();
    const tokenFamily = randomUUID();
    const expectedJti = randomUUID();
    const nextJtis = [randomUUID(), randomUUID()];
    await prisma.authSession.create({
      data: {
        id: sessionId,
        userId: seeded.users.adminUserId,
        tokenFamily,
        currentJti: expectedJti,
        refreshTokenHash: 'test-only-hash',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const repository = new PrismaAuthSessionRepository(prisma as never);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const results = await Promise.all(nextJtis.map(async (jti) => {
      arrivals += 1;
      if (arrivals === nextJtis.length) release();
      await barrier;
      return repository.rotate(
        sessionId,
        expectedJti,
        `test-only-hash-${jti}`,
        jti,
        new Date(Date.now() + 120_000),
      );
    }));
    const persisted = await prisma.authSession.findUniqueOrThrow({ where: { id: sessionId } });

    assert.deepEqual(results.sort(), [false, true]);
    assert.ok(nextJtis.includes(persisted.currentJti));
  });

  await it('concurrent refresh rotation and logout leaves the persisted session revoked', async () => {
    const sessionId = randomUUID();
    const tokenFamily = randomUUID();
    const expectedJti = randomUUID();
    await prisma.authSession.create({
      data: {
        id: sessionId,
        userId: seeded.users.adminUserId,
        tokenFamily,
        currentJti: expectedJti,
        refreshTokenHash: 'test-only-hash',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const repository = new PrismaAuthSessionRepository(prisma as never);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const gate = async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await barrier;
    };
    const [rotated] = await Promise.all([
      (async () => {
        await gate();
        return repository.rotate(sessionId, expectedJti, 'rotated-hash', 'rotated-jti', new Date(Date.now() + 120_000));
      })(),
      (async () => {
        await gate();
        await repository.revoke(sessionId);
      })(),
    ]);
    const persisted = await prisma.authSession.findUniqueOrThrow({ where: { id: sessionId } });
    assert.notEqual(persisted.revokedAt, null);
    assert.ok(rotated === true || persisted.currentJti === expectedJti);
  });

  await it('concurrent 2FA challenge consumption has exactly one winner', async () => {
    const challengeId = randomUUID();
    await prisma.authTwoFactorChallenge.create({
      data: {
        id: challengeId,
        userId: seeded.users.adminUserId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const repository = new PrismaTwoFactorChallengeRepository(prisma as never);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const results = await Promise.all(Array.from({ length: 2 }, async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await barrier;
      return repository.consume(challengeId, seeded.users.adminUserId);
    }));
    assert.deepEqual(results.sort(), [false, true]);
  });

  await it('rejects unauthorized admin access', async () => {
    const response = await http.get(
      `/api/v1/admin/users/${seeded.users.adminUserId}`,
    );
    assert.equal(response.status, 401);
  });

  await it('accepts an authorized admin and rejects malformed, expired, wrong-signature and wrong-purpose tokens', async () => {
    await resetAppRateLimitState();
    const challengeLogin = await http.post('/api/v1/auth/login').send({
      email: seeded.users.adminEmail,
      password: seeded.users.adminPassword,
    });
    assert.equal(challengeLogin.status, 201);
    const session = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    const valid = await http.get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${session.accessToken}`);
    assert.equal(valid.status, 200);

    const jwt = require('jsonwebtoken') as { sign(payload: object, secret: string, options: object): string };
    const accessClaims = { sub: seeded.users.adminUserId, email: seeded.users.adminEmail, role: 'admin', sessionId: randomUUID() };
    const expiredAccess = jwt.sign(accessClaims, process.env.JWT_ACCESS_SECRET!, {
      issuer: 'distritoolsjl', audience: 'admin-api', expiresIn: -1,
    });
    const wrongSignature = jwt.sign(accessClaims, 'wrong-test-signature', {
      issuer: 'distritoolsjl', audience: 'admin-api', expiresIn: 60,
    });
    const invalidTokens = ['not-a-jwt', expiredAccess, wrongSignature, session.refreshToken, challengeLogin.body.challengeToken];
    for (const token of invalidTokens) {
      const response = await http.get('/api/v1/admin/users').set('Authorization', `Bearer ${token}`);
      assert.equal(response.status, 401);
      assert.equal(JSON.stringify(response.body).includes(token), false);
    }

    const accessAsRefresh = await http.post('/api/v1/auth/refresh')
      .send({ refreshToken: session.accessToken });
    assert.equal(accessAsRefresh.status, 401);
    const refreshClaims = {
      sub: seeded.users.adminUserId,
      email: seeded.users.adminEmail,
      role: 'admin',
      sessionId: randomUUID(),
      jti: randomUUID(),
      family: randomUUID(),
    };
    const expiredRefresh = jwt.sign(refreshClaims, process.env.JWT_REFRESH_SECRET!, {
      issuer: 'distritoolsjl', audience: 'admin-refresh', expiresIn: -1,
    });
    const expiredRefreshResponse = await http.post('/api/v1/auth/refresh')
      .send({ refreshToken: expiredRefresh });
    assert.equal(expiredRefreshResponse.status, 401);
    const accessAsChallenge = await http.post('/api/v1/auth/verify-2fa').send({
      challengeToken: session.accessToken,
      code: await generate({ secret: seeded.users.twoFactorSecret }),
    });
    assert.equal(accessAsChallenge.status, 401);
  });

  await it('logout revokes the current session for both access and refresh use', async () => {
    await resetAppRateLimitState();
    const session = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    const logout = await http.post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`);
    assert.equal(logout.status, 201);
    const protectedAfterLogout = await http.get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${session.accessToken}`);
    const refreshAfterLogout = await http.post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    assert.equal(protectedAfterLogout.status, 401);
    assert.equal(refreshAfterLogout.status, 401);
  });

  await it('refresh replay compromises the token family and rejects the rotated token', async () => {
    await resetAppRateLimitState();
    const session = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    const firstRotation = await http.post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    assert.equal(firstRotation.status, 201);
    const replay = await http.post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    const rotatedAfterReplay = await http.post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRotation.body.refreshToken });
    assert.equal(replay.status, 401);
    assert.equal(rotatedAfterReplay.status, 401);
  });

  await it('returns the same login failure for unknown and inactive users', async () => {
    await resetAppRateLimitState();
    const existingSession = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    const unknown = await http.post('/api/v1/auth/login').send({
      email: 'unknown-user@distritools.local', password: 'invalid-password',
    });
    await prisma.user.update({ where: { id: seeded.users.adminUserId }, data: { isActive: false } });
    let inactive;
    try {
      inactive = await http.post('/api/v1/auth/login').send({
        email: seeded.users.adminEmail, password: seeded.users.adminPassword,
      });
      const protectedRequest = await http.get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${existingSession.accessToken}`);
      const refreshRequest = await http.post('/api/v1/auth/refresh')
        .send({ refreshToken: existingSession.refreshToken });
      assert.equal(protectedRequest.status, 401);
      assert.equal(refreshRequest.status, 401);
    } finally {
      await prisma.user.update({ where: { id: seeded.users.adminUserId }, data: { isActive: true } });
    }
    assert.equal(unknown.status, 401);
    assert.equal(inactive!.status, 401);
    assert.deepEqual(inactive!.body.message, unknown.body.message);
  });

  await it('keeps the existing auth throttle on login and 2FA verification', async () => {
    await resetAppRateLimitState();
    const loginResponses = await Promise.all(Array.from({ length: 6 }, () => http.post('/api/v1/auth/login').send({
      email: 'throttle-probe@distritools.local', password: 'invalid-test-password',
    })));
    assert.ok(loginResponses.slice(0, 5).every((response) => response.status === 401));
    assert.equal(loginResponses[5].status, 429);

    await resetAppRateLimitState();
    const challengeResponses = await Promise.all(Array.from({ length: 6 }, () => http.post('/api/v1/auth/verify-2fa').send({
      challengeToken: 'invalid-test-challenge', code: '000000',
    })));
    assert.ok(challengeResponses.slice(0, 5).every((response) => response.status === 401));
    assert.equal(challengeResponses[5].status, 429);
  });

  await it('does not trust spoofed X-Forwarded-For without explicit proxy configuration', async () => {
    await resetAppRateLimitState();
    assert.equal(app.getHttpAdapter().getInstance().get('trust proxy'), false);
    const spoofedIp = '203.0.113.77';
    const response = await http.post('/api/v1/auth/login')
      .set('X-Forwarded-For', spoofedIp)
      .send({ email: seeded.users.adminEmail, password: seeded.users.adminPassword });
    assert.equal(response.status, 201);
    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: seeded.users.adminUserId, action: 'auth.login_challenged' },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit);
    assert.notEqual(audit.ipAddress, spoofedIp);
  });

  await it('enforces RBAC for forbidden actions', async () => {
    await resetAppRateLimitState();
    const viewer = await loginAsAdmin(
      http,
      seeded.users.viewerEmail,
      seeded.users.viewerPassword,
      seeded.users.twoFactorSecret,
    );

    const response = await http
      .post('/api/v1/admin/inventory/reserve')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        referenceType: 'test',
        referenceId: 'rbac-check',
        lines: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 1,
          },
        ],
      });

    assert.equal(response.status, 403);
  });
});
