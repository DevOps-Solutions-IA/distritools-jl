import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { syntheticSecret } from 'tests/helpers/synthetic-secret';

describe('production authentication startup guard', () => {
  it('fails Nest startup when secrets are missing or admin bypass is enabled under conflicting envs', () => {
    const script = [
      "const { NestFactory } = require('@nestjs/core');",
      "const { AppModule } = require('./src/app/app.module');",
      "NestFactory.create(AppModule).then((app) => app.close()).catch((error) => { process.stderr.write(String(error.message)); process.exitCode = 23; });",
    ].join('');
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 8_000,
      env: {
        ...process.env,
        NODE_PATH: '.',
        NODE_ENV: 'production',
        APP_ENV: 'local',
        ADMIN_AUTH_DISABLED: 'true',
        JWT_ACCESS_SECRET: '',
        JWT_REFRESH_SECRET: '',
        JWT_2FA_CHALLENGE_SECRET: '',
        TWO_FACTOR_ENCRYPTION_KEY: '',
      },
    });

    assert.notEqual(result.error?.code, 'ETIMEDOUT');
    assert.notEqual(result.status, 0);
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /Invalid production authentication security configuration/);
    assert.match(output, /ADMIN_AUTH_DISABLED/);
    assert.doesNotMatch(output, /test-access-secret|test-refresh-secret|test-two-factor/);
  });

  it('fails staging startup when a configured token TTL exceeds its approved maximum', () => {
    const script = [
      "const { NestFactory } = require('@nestjs/core');",
      "const { AppModule } = require('./src/app/app.module');",
      "NestFactory.create(AppModule).then((app) => app.close()).catch((error) => { process.stderr.write(String(error.message)); process.exitCode = 23; });",
    ].join('');
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 8_000,
      env: {
        ...process.env,
        NODE_PATH: '.',
        NODE_ENV: 'test',
        APP_ENV: 'staging',
        ADMIN_AUTH_DISABLED: 'false',
        JWT_ACCESS_SECRET: syntheticSecret('access'),
        JWT_REFRESH_SECRET: syntheticSecret('refresh'),
        JWT_2FA_CHALLENGE_SECRET: syntheticSecret('challenge'),
        TWO_FACTOR_ENCRYPTION_KEY: syntheticSecret('two-factor-encryption'),
        JWT_REFRESH_TTL: '36500d',
      },
    });

    assert.notEqual(result.error?.code, 'ETIMEDOUT');
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /JWT_REFRESH_TTL/);
  });

  it('rejects an empty production CORS allowlist before creating the Nest server', () => {
    const script = [
      "const { bootstrap } = require('./src/app/bootstrap');",
      "bootstrap().catch((error) => { process.stderr.write(String(error.message)); process.exitCode = 23; });",
    ].join('');
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 8_000,
      env: {
        ...process.env,
        NODE_PATH: '.',
        NODE_ENV: 'production',
        APP_ENV: 'production',
        CORS_ORIGINS: '',
        JWT_ACCESS_SECRET: syntheticSecret('access'),
        JWT_REFRESH_SECRET: syntheticSecret('refresh'),
        JWT_2FA_CHALLENGE_SECRET: syntheticSecret('challenge'),
        TWO_FACTOR_ENCRYPTION_KEY: syntheticSecret('two-factor-encryption'),
        ADMIN_AUTH_DISABLED: 'false',
      },
    });

    assert.notEqual(result.error?.code, 'ETIMEDOUT');
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /CORS_ORIGINS is empty in production\/staging/);
  });

  it('rejects wildcard production CORS when credentials are enabled', () => {
    const script = [
      "const { bootstrap } = require('./src/app/bootstrap');",
      "bootstrap().catch((error) => { process.stderr.write(String(error.message)); process.exitCode = 23; });",
    ].join('');
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 8_000,
      env: {
        ...process.env,
        NODE_PATH: '.',
        NODE_ENV: 'production',
        APP_ENV: 'production',
        CORS_ORIGINS: '*',
        JWT_ACCESS_SECRET: syntheticSecret('access'),
        JWT_REFRESH_SECRET: syntheticSecret('refresh'),
        JWT_2FA_CHALLENGE_SECRET: syntheticSecret('challenge'),
        TWO_FACTOR_ENCRYPTION_KEY: syntheticSecret('two-factor-encryption'),
        ADMIN_AUTH_DISABLED: 'false',
      },
    });

    assert.notEqual(result.error?.code, 'ETIMEDOUT');
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /wildcard CORS_ORIGINS is not allowed/);
  });
});
