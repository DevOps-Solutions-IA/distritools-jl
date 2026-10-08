import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAuthSecurityConfigIssues } from 'src/common/security/auth-security-config';
import { syntheticSecret } from 'tests/helpers/synthetic-secret';

const validSecrets: NodeJS.ProcessEnv = {
  APP_ENV: 'production',
  JWT_ACCESS_SECRET: syntheticSecret('access'),
  JWT_REFRESH_SECRET: syntheticSecret('refresh'),
  JWT_2FA_CHALLENGE_SECRET: syntheticSecret('challenge'),
  TWO_FACTOR_ENCRYPTION_KEY: syntheticSecret('encryption'),
  ADMIN_AUTH_DISABLED: 'false',
};

describe('auth security production configuration', () => {
  it('accepts explicitly configured production secrets without exposing their values', () => {
    assert.deepEqual(getAuthSecurityConfigIssues(validSecrets), []);
  });

  it('rejects missing and placeholder auth secrets and disabled admin auth', () => {
    const issues = getAuthSecurityConfigIssues({
      ...validSecrets,
      JWT_REFRESH_SECRET: 'change-me-refresh',
      JWT_2FA_CHALLENGE_SECRET: undefined,
      TWO_FACTOR_ENCRYPTION_KEY: 'short',
      ADMIN_AUTH_DISABLED: 'true',
    });
    assert.deepEqual(issues, [
      'JWT_REFRESH_SECRET',
      'JWT_2FA_CHALLENGE_SECRET',
      'TWO_FACTOR_ENCRYPTION_KEY',
      'ADMIN_AUTH_DISABLED',
    ]);
  });

  it('treats NODE_ENV production as production even when APP_ENV says local', () => {
    assert.deepEqual(getAuthSecurityConfigIssues({
      ...validSecrets,
      APP_ENV: 'local',
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: undefined,
    }), ['JWT_ACCESS_SECRET']);
  });

  it('rejects short JWT signing secrets and abbreviated production labels', () => {
    const issues = getAuthSecurityConfigIssues({
      ...validSecrets,
      APP_ENV: 'local',
      NODE_ENV: 'prod',
      JWT_ACCESS_SECRET: 'short-but-not-a-placeholder',
      JWT_REFRESH_SECRET: 'r'.repeat(31),
    });
    assert.deepEqual(issues, ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']);
  });

  it('rejects repeated or low-diversity signing secrets', () => {
    assert.deepEqual(getAuthSecurityConfigIssues({
      ...validSecrets,
      JWT_ACCESS_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'abc123'.repeat(8),
      TWO_FACTOR_ENCRYPTION_KEY: 'a'.repeat(64),
    }), ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TWO_FACTOR_ENCRYPTION_KEY']);
  });

  it('validates the exact 32-byte 2FA key material rather than an entropy-rich suffix', () => {
    assert.deepEqual(getAuthSecurityConfigIssues({
      ...validSecrets,
      TWO_FACTOR_ENCRYPTION_KEY: `${'a'.repeat(32)}${syntheticSecret('high-entropy-suffix')}`,
    }), ['TWO_FACTOR_ENCRYPTION_KEY']);
    assert.deepEqual(getAuthSecurityConfigIssues({
      ...validSecrets,
      TWO_FACTOR_ENCRYPTION_KEY: `${'é'.repeat(32)}${syntheticSecret('multibyte-suffix')}`,
    }), ['TWO_FACTOR_ENCRYPTION_KEY']);
  });

  it('allows positive TTLs through each production maximum and equivalent units', () => {
    const allowed = [
      { JWT_ACCESS_TTL: '15m' },
      { JWT_ACCESS_TTL: '14m' },
      { JWT_REFRESH_TTL: '7d' },
      { JWT_REFRESH_TTL: '168h' },
      { JWT_2FA_CHALLENGE_TTL: '10m' },
      { JWT_2FA_CHALLENGE_TTL: '9m' },
    ];
    for (const ttl of allowed) {
      assert.deepEqual(getAuthSecurityConfigIssues({ ...validSecrets, ...ttl }), [], JSON.stringify(ttl));
    }
  });

  it('rejects TTLs over their credential-specific maximum in production and staging', () => {
    const rejected = [
      { JWT_ACCESS_TTL: '16m' },
      { JWT_ACCESS_TTL: '1h' },
      { JWT_REFRESH_TTL: '8d' },
      { JWT_REFRESH_TTL: '36500d' },
      { JWT_2FA_CHALLENGE_TTL: '11m' },
      { JWT_2FA_CHALLENGE_TTL: '1h' },
    ];
    for (const ttl of rejected) {
      const env = { ...validSecrets, ...ttl };
      const expected = Object.keys(ttl);
      assert.deepEqual(getAuthSecurityConfigIssues(env), expected, JSON.stringify(ttl));
      assert.deepEqual(getAuthSecurityConfigIssues({ ...env, APP_ENV: 'staging' }), expected, JSON.stringify(ttl));
    }
  });

  it('uses bounded defaults when TTL variables are absent in production and staging', () => {
    for (const APP_ENV of ['production', 'staging']) {
      const env = { ...validSecrets, APP_ENV };
      delete env.JWT_ACCESS_TTL;
      delete env.JWT_REFRESH_TTL;
      delete env.JWT_2FA_CHALLENGE_TTL;
      assert.deepEqual(getAuthSecurityConfigIssues(env), []);
    }
  });

  it('rejects zero, negative, malformed, ambiguous and overflowing TTL values', () => {
    const invalidValues = ['0m', '-1m', '+1m', '1.5m', '1s', '1M', ' 1m', '1m ', '999999999999999999999d', '100000000d'];
    for (const value of invalidValues) {
      assert.deepEqual(getAuthSecurityConfigIssues({
        ...validSecrets,
        JWT_ACCESS_TTL: value,
      }), ['JWT_ACCESS_TTL'], value);
    }
  });

  it('rejects production placeholders when APP_ENV is staging', () => {
    const issues = getAuthSecurityConfigIssues({
      APP_ENV: 'staging',
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'change-me-access',
      JWT_REFRESH_SECRET: 'change-me-refresh',
      JWT_2FA_CHALLENGE_SECRET: 'change-me-2fa-challenge',
      TWO_FACTOR_ENCRYPTION_KEY: '',
      ADMIN_AUTH_DISABLED: 'false',
    });
    assert.deepEqual(issues, [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_2FA_CHALLENGE_SECRET',
      'TWO_FACTOR_ENCRYPTION_KEY',
    ]);
  });

  it('does not require production secrets in local/test environments', () => {
    assert.deepEqual(getAuthSecurityConfigIssues({ APP_ENV: 'test' }), []);
  });
});
