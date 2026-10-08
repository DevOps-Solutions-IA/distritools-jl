import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { MonitoringController } from 'src/infra/monitoring/monitoring.controller';
import { syntheticSecret } from 'tests/helpers/synthetic-secret';

describe('auth security readiness', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails readiness when production secrets are invalid even if DB and Redis are reachable', async () => {
    process.env.APP_ENV = 'local';
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_2FA_CHALLENGE_SECRET;
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    process.env.ADMIN_AUTH_DISABLED = 'true';

    const controller = new MonitoringController(
      { $queryRaw: async () => 1 } as never,
      { waitUntilReady: async () => undefined, client: { ping: async () => 'PONG' } } as never,
      null,
      { snapshot: () => ({}) } as never,
      100,
    );
    let statusCode = 0;
    const body = await controller.getReadiness({ status: (value: number) => { statusCode = value; } } as never);

    assert.equal(statusCode, 503);
    assert.equal(body.ready, false);
    assert.equal(body.checks.authSecurity, 'invalid');
    assert.equal(body.checks.database, 'ok');
    assert.equal(body.checks.queueProducer, 'ready');
  });

  it('fails readiness when production token TTL exceeds its approved maximum', async () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_AUTH_DISABLED = 'false';
    process.env.JWT_ACCESS_SECRET = syntheticSecret('access');
    process.env.JWT_REFRESH_SECRET = syntheticSecret('refresh');
    process.env.JWT_2FA_CHALLENGE_SECRET = syntheticSecret('challenge');
    process.env.TWO_FACTOR_ENCRYPTION_KEY = syntheticSecret('two-factor-encryption');
    process.env.JWT_REFRESH_TTL = '36500d';

    const controller = new MonitoringController(
      { $queryRaw: async () => 1 } as never,
      { waitUntilReady: async () => undefined, client: { ping: async () => 'PONG' } } as never,
      null,
      { snapshot: () => ({}) } as never,
      100,
    );
    let statusCode = 0;
    const body = await controller.getReadiness({ status: (value: number) => { statusCode = value; } } as never);

    assert.equal(statusCode, 503);
    assert.equal(body.ready, false);
    assert.equal(body.checks.authSecurity, 'invalid');
  });
});
