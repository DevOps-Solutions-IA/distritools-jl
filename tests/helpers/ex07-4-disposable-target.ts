import assert from 'node:assert/strict';

export function assertDisposableTarget(env: NodeJS.ProcessEnv = process.env) {
  assert.equal(env.APP_ENV, 'test');
  const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
    validateTestEnvironment: (environment: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] };
  };
  const target = validateTestEnvironment(env);
  assert.equal(target.ok, true, target.failures.join('; '));
}
