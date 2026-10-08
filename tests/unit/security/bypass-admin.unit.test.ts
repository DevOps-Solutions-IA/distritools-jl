import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { isDevAdminAuthDisabled } from 'src/common/security/dev-admin-bypass';

describe('isDevAdminAuthDisabled', () => {
  let originalEnv: NodeJS.ProcessEnv;

  function setEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete (process.env as Record<string, string>)[key];
    } else {
      process.env[key] = value;
    }
  }

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when APP_ENV is undefined (even with ADMIN_AUTH_DISABLED=true)', () => {
    setEnv('APP_ENV', undefined);
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('returns false when APP_ENV=production and ADMIN_AUTH_DISABLED=true', () => {
    process.env.APP_ENV = 'production';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('returns false when NODE_ENV=production even if APP_ENV=local', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'local';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('returns false when NODE_ENV=production uses mixed case and APP_ENV=local', () => {
    process.env.NODE_ENV = 'Production';
    process.env.APP_ENV = 'local';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('does not allow a malformed or unknown APP_ENV to enable bypass', () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'prod';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('does not allow APP_ENV=local to override NODE_ENV=prod', () => {
    process.env.NODE_ENV = 'prod';
    process.env.APP_ENV = 'local';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('returns true when APP_ENV=local and ADMIN_AUTH_DISABLED=true', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'local';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), true);
  });

  it('returns true when APP_ENV=test and ADMIN_AUTH_DISABLED=true', () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'test';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), true);
  });

  it('returns false when APP_ENV=local but ADMIN_AUTH_DISABLED=false', () => {
    process.env.APP_ENV = 'local';
    process.env.ADMIN_AUTH_DISABLED = 'false';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });

  it('returns false when APP_ENV=staging (not in allowlist) with ADMIN_AUTH_DISABLED=true', () => {
    process.env.APP_ENV = 'staging';
    process.env.ADMIN_AUTH_DISABLED = 'true';
    assert.strictEqual(isDevAdminAuthDisabled(), false);
  });
});
