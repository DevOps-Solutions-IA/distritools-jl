import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProductionOrStaging } from 'src/common/security/env-check';

describe('isProductionOrStaging', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('treats production NODE_ENV as restrictive even when APP_ENV says local', () => {
    process.env.APP_ENV = 'local';
    process.env.NODE_ENV = 'production';
    assert.equal(isProductionOrStaging(), true);
  });

  it('treats staging APP_ENV as restrictive even when NODE_ENV says test', () => {
    process.env.APP_ENV = 'staging';
    process.env.NODE_ENV = 'test';
    assert.equal(isProductionOrStaging(), true);
  });

  it('treats abbreviated production labels as restrictive across either environment variable', () => {
    assert.equal(isProductionOrStaging({ APP_ENV: 'local', NODE_ENV: 'prod' }), true);
    assert.equal(isProductionOrStaging({ APP_ENV: 'PROD', NODE_ENV: 'test' }), true);
    assert.equal(isProductionOrStaging({ APP_ENV: ' production ', NODE_ENV: 'test' }), true);
  });

  it('does not treat local and test as production environments', () => {
    process.env.APP_ENV = 'local';
    process.env.NODE_ENV = 'test';
    assert.equal(isProductionOrStaging(), false);
  });
});
