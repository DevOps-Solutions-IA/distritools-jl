const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluateProductionConfig } = require('../production-readiness-guard');

const safeReady = {
  APP_ENV: 'production',
  ADMIN_AUTH_DISABLED: 'false',
  JWT_ACCESS_SECRET: 'independent-access-secret-from-secret-store',
  JWT_REFRESH_SECRET: 'independent-refresh-secret-from-secret-store',
  JWT_2FA_CHALLENGE_SECRET: 'independent-2fa-challenge-secret-from-secret-store',
  TWO_FACTOR_ENCRYPTION_KEY: 'independent-two-factor-encryption-secret',
  PUBLIC_APP_URL: 'https://store.example.com',
  SHIPPING_PROVIDER: '99envios',
  AUTO_SHIPPING_MODE: 'quote_and_create_guide',
  NINETY_NINE_ENVIOS_API_BASE_URL: 'https://integration.99envios.app',
  NINETY_NINE_ENVIOS_AUTH_EMAIL: 'configured',
  NINETY_NINE_ENVIOS_AUTH_PASSWORD: 'configured',
  NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE: 'branch-configured',
  NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE: '11001000',
  EMAIL_PROVIDER: 'smtp',
  PRODUCTION_READINESS_STATUS: 'READY_FOR_PRODUCTION',
};

test('accepts a production-ready profile without returning secret values', () => {
  const result = evaluateProductionConfig(safeReady);

  assert.deepEqual(result.failures, []);
  assert.equal(JSON.stringify(result).includes(safeReady.JWT_ACCESS_SECRET), false);
  assert.equal(JSON.stringify(result).includes(safeReady.NINETY_NINE_ENVIOS_AUTH_PASSWORD), false);
});

test('rejects mock shipping in production even when readiness claims ready', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    SHIPPING_PROVIDER: 'mock_99envios',
  });

  assert.ok(result.failures.some((failure) => /mock provider/.test(failure)));
});

test('rejects disabled admin auth, placeholder secrets and temporary domains', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    ADMIN_AUTH_DISABLED: 'true',
    JWT_ACCESS_SECRET: 'change-me-access',
    PUBLIC_APP_URL: 'https://demo.trycloudflare.com',
  });

  assert.ok(result.failures.some((failure) => /ADMIN_AUTH_DISABLED/.test(failure)));
  assert.ok(result.failures.some((failure) => /JWT_ACCESS_SECRET/.test(failure)));
  assert.ok(result.failures.some((failure) => /stable HTTPS domain/.test(failure)));
});

test('fails closed when production readiness or explicit admin-auth state is missing', () => {
  const result = evaluateProductionConfig({ APP_ENV: 'production' });

  assert.ok(result.failures.some((failure) => /ADMIN_AUTH_DISABLED must be explicitly false/.test(failure)));
  assert.ok(result.failures.some((failure) => /readiness status must be explicit/.test(failure)));
});

test('requires challenge and encryption secrets before claiming production readiness', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    JWT_2FA_CHALLENGE_SECRET: '',
    TWO_FACTOR_ENCRYPTION_KEY: 'short',
  });

  assert.ok(result.failures.some((failure) => /JWT_2FA_CHALLENGE_SECRET/.test(failure)));
  assert.ok(result.failures.some((failure) => /TWO_FACTOR_ENCRYPTION_KEY/.test(failure)));
});

test('rejects weak JWT signing secrets even when they are non-placeholder values', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    JWT_ACCESS_SECRET: 'x',
    JWT_REFRESH_SECRET: 'y',
    JWT_2FA_CHALLENGE_SECRET: 'z',
  });

  assert.ok(result.failures.some((failure) => /JWT_ACCESS_SECRET/.test(failure)));
  assert.ok(result.failures.some((failure) => /JWT_REFRESH_SECRET/.test(failure)));
  assert.ok(result.failures.some((failure) => /JWT_2FA_CHALLENGE_SECRET/.test(failure)));
});

test('requires known provider credentials when online payments are enabled', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    PSE_ENABLED: 'true',
    PAYMENT_PROVIDER: 'wompi',
  });

  assert.ok(result.failures.some((failure) => /WOMPI_PRIVATE_KEY/.test(failure)));
});

test('does not accept unknown online payment providers as production-ready', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    PAYMENTS_REAL_PROVIDER_ENABLED: 'true',
    PAYMENT_PROVIDER: 'made-up-provider',
  });

  assert.ok(result.failures.some((failure) => /unsupported payment provider/.test(failure)));
});

test('allows explicitly blocked production while providers are not configured', () => {
  const result = evaluateProductionConfig({
    APP_ENV: 'production',
    ADMIN_AUTH_DISABLED: 'false',
    PRODUCTION_READINESS_STATUS: 'BLOCKED_FOR_PRODUCTION',
    SHIPPING_PROVIDER: 'internal',
  });

  assert.deepEqual(result.failures, []);
});

test('rejects unknown readiness status instead of treating it as blocked', () => {
  const result = evaluateProductionConfig({
    APP_ENV: 'production',
    ADMIN_AUTH_DISABLED: 'false',
    SHIPPING_PROVIDER: 'internal',
    PRODUCTION_READINESS_STATUS: 'UNKNOWN',
  });

  assert.ok(result.failures.some((failure) => /readiness status must be explicit/.test(failure)));
});

test('does not claim readiness for incomplete real shipping credentials', () => {
  const result = evaluateProductionConfig({
    ...safeReady,
    NINETY_NINE_ENVIOS_AUTH_PASSWORD: '',
  });

  assert.ok(result.failures.some((failure) => /99 Envíos credentials/.test(failure)));
});

test('allows local test mocks without treating them as production readiness', () => {
  const result = evaluateProductionConfig({
    APP_ENV: 'test',
    SHIPPING_PROVIDER: 'mock_99envios',
    PRODUCTION_READINESS_STATUS: 'BLOCKED_FOR_PRODUCTION',
  });

  assert.deepEqual(result.failures, []);
});
