const assert = require('node:assert/strict');
const test = require('node:test');
const { validateTestEnvironment } = require('../assert-test-environment');

test('accepts loopback PostgreSQL and Redis targets with an explicit test database name', () => {
  const result = validateTestEnvironment({
    CI: 'true',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:secret@127.0.0.1:49123/distritoolsjl_test?schema=public',
    REDIS_URL: 'redis://127.0.0.1:49124',
  });

  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('rejects otherwise-valid test targets outside CI-owned service context', () => {
  const result = validateTestEnvironment({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:secret@127.0.0.1:49123/distritoolsjl_test?schema=public',
    REDIS_URL: 'redis://127.0.0.1:49124',
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => /CI-owned isolated test services/.test(failure)));
});

test('allows standard Postgres and Redis ports only for CI-owned services', () => {
  const result = validateTestEnvironment({
    CI: 'true',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:secret@127.0.0.1:5432/distritoolsjl_test?schema=public',
    REDIS_URL: 'redis://127.0.0.1:6379',
  });

  assert.equal(result.ok, true);
});

test('rejects non-test mode, production DB names, remote hosts, and remote Redis', () => {
  for (const env of [
    { NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/app_test', REDIS_URL: 'redis://localhost:6379' },
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://127.0.0.1/app', REDIS_URL: 'redis://127.0.0.1:6379' },
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://db.example.com/app_test', REDIS_URL: 'redis://127.0.0.1:6379' },
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/app_test', REDIS_URL: 'redis://redis.example.com:6379' },
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres/app_test', REDIS_URL: 'redis://localhost:6379' },
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:55440/distritoolsjl_test', REDIS_URL: 'redis://localhost:56379' },
  ]) {
    assert.equal(validateTestEnvironment(env).ok, false);
  }
});
