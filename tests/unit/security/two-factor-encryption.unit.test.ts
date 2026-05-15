import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('twoFactorCrypto', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let encryptTwoFactorSecret: (s: string) => string;
  let decryptTwoFactorSecret: (s: string | null) => string | null;

  function reloadModule() {
    const mod = require('src/common/security/two-factor-crypto');
    encryptTwoFactorSecret = mod.encryptTwoFactorSecret;
    decryptTwoFactorSecret = mod.decryptTwoFactorSecret;
  }

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a-strong-32-char-encryption-key!';
    delete require.cache[require.resolve('src/common/security/two-factor-crypto')];
    reloadModule();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts correctly', () => {
    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptTwoFactorSecret(original);

    assert.ok(encrypted.startsWith('enc:'));
    assert.ok(encrypted.length > 20);

    const decrypted = decryptTwoFactorSecret(encrypted);
    assert.strictEqual(decrypted, original);
  });

  it('encrypted value does not contain the plaintext secret', () => {
    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptTwoFactorSecret(original);

    assert.ok(!encrypted.includes(original));
  });

  it('returns null when decrypting null', () => {
    assert.strictEqual(decryptTwoFactorSecret(null), null);
  });

  it('returns original value for non-encrypted (legacy plaintext) data', () => {
    const legacy = 'JBSWY3DPEHPK3PXP';
    assert.strictEqual(decryptTwoFactorSecret(legacy), legacy);
  });

  it('returns null for corrupted encrypted data', () => {
    assert.strictEqual(decryptTwoFactorSecret('enc:corrupted-data'), null);
  });

  it('returns plaintext when TWO_FACTOR_ENCRYPTION_KEY is missing (dev fallback)', () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'short';
    reloadModule();

    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptTwoFactorSecret(original);
    assert.strictEqual(encrypted, original);

    const decrypted = decryptTwoFactorSecret(encrypted);
    assert.strictEqual(decrypted, original);
  });

  it('two different encryptions of the same secret produce different ciphertexts', () => {
    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted1 = encryptTwoFactorSecret(original);
    const encrypted2 = encryptTwoFactorSecret(original);

    assert.notStrictEqual(encrypted1, encrypted2);
  });
});
