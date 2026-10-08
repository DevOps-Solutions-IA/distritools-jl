import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { hasPlausibleSecretEntropy } from './auth-security-config';
import { isProductionOrStaging } from './env-check';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

function getKey(): Buffer | null {
  const envKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  const productionLike = isProductionOrStaging();

  if (!envKey || envKey.length < 32) {
    if (productionLike) {
      throw new Error(
        'FATAL: TWO_FACTOR_ENCRYPTION_KEY is missing or shorter than 32 characters in production/staging. ' +
        '2FA secrets cannot be stored securely without a strong encryption key.',
      );
    }
    return null;
  }

  const keyMaterial = envKey.slice(0, 32);
  const key = Buffer.from(keyMaterial, 'utf8');
  if (key.length !== 32 || (productionLike && !hasPlausibleSecretEntropy(keyMaterial))) {
    if (productionLike) {
      throw new Error('FATAL: TWO_FACTOR_ENCRYPTION_KEY must provide 32 diverse ASCII bytes in production/staging.');
    }
    return null;
  }

  return key;
}

export function encryptTwoFactorSecret(secret: string): string {
  const key = getKey();

  if (!key) {
    return secret;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return PREFIX + combined.toString('base64url');
}

export function decryptTwoFactorSecret(stored: string | null): string | null {
  if (!stored) {
    return null;
  }

  if (!stored.startsWith(PREFIX)) {
    if (isProductionOrStaging()) {
      throw new Error('Unencrypted 2FA secret rejected in production/staging.');
    }
    return stored;
  }

  const key = getKey();

  if (!key) {
    return stored;
  }

  try {
    const combined = Buffer.from(stored.slice(PREFIX.length), 'base64url');
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
