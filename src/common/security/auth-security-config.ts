import { isProductionOrStaging } from './env-check';

const PLACEHOLDER_SECRETS = new Set([
  'change-me-access',
  'change-me-refresh',
  'change-me-2fa-challenge',
  'change-me-encryption',
]);
const TOKEN_TTL_POLICIES = {
  JWT_ACCESS_TTL: { defaultValue: '15m', maximumMilliseconds: 15 * 60 * 1000 },
  JWT_REFRESH_TTL: { defaultValue: '7d', maximumMilliseconds: 7 * 24 * 60 * 60 * 1000 },
  JWT_2FA_CHALLENGE_TTL: { defaultValue: '10m', maximumMilliseconds: 10 * 60 * 1000 },
} as const;
type TokenTtlName = keyof typeof TOKEN_TTL_POLICIES;

export function parseTokenTtlMilliseconds(
  name: TokenTtlName,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const policy = TOKEN_TTL_POLICIES[name];
  const value = env[name] ?? policy.defaultValue;
  const match = value.match(/^([1-9]\d*)(m|h|d)$/);
  if (!match) throw new Error(`Invalid authentication token lifetime: ${name}`);

  const valueCount = Number(match[1]);
  if (!Number.isSafeInteger(valueCount)) throw new Error(`Invalid authentication token lifetime: ${name}`);

  const multiplier = match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : 86_400_000;
  const milliseconds = valueCount * multiplier;
  const expiry = Date.now() + milliseconds;
  if (!Number.isSafeInteger(milliseconds) || !Number.isFinite(expiry) || expiry > 8.64e15) {
    throw new Error(`Invalid authentication token lifetime: ${name}`);
  }

  if (isProductionOrStaging(env) && milliseconds > policy.maximumMilliseconds) {
    throw new Error(`Invalid authentication token lifetime: ${name}`);
  }

  return milliseconds;
}

export function hasPlausibleSecretEntropy(value: string): boolean {
  if (value.length < 32 || PLACEHOLDER_SECRETS.has(value)) return false;

  for (let period = 1; period <= 8; period += 1) {
    const repeated = value.slice(0, period).repeat(Math.ceil(value.length / period)).slice(0, value.length);
    if (repeated === value) return false;
  }

  const frequencies = new Map<string, number>();
  for (const character of value) frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  if (frequencies.size < 16) return false;

  const entropyPerCharacter = [...frequencies.values()].reduce((entropy, count) => {
    const probability = count / value.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
  return entropyPerCharacter >= 3.5;
}

export function getAuthSecurityConfigIssues(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const productionLike = isProductionOrStaging(env);
  if (!productionLike) return [];

  const issues: string[] = [];
  for (const name of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_2FA_CHALLENGE_SECRET',
  ]) {
    const value = env[name];
    if (!value || !hasPlausibleSecretEntropy(value)) issues.push(name);
  }

  const encryptionKey = env.TWO_FACTOR_ENCRYPTION_KEY;
  const encryptionMaterial = encryptionKey?.slice(0, 32);
  if (
    !encryptionMaterial ||
    Buffer.byteLength(encryptionMaterial, 'utf8') !== 32 ||
    !hasPlausibleSecretEntropy(encryptionMaterial)
  ) {
    issues.push('TWO_FACTOR_ENCRYPTION_KEY');
  }

  if (env.ADMIN_AUTH_DISABLED?.toLowerCase() === 'true') {
    issues.push('ADMIN_AUTH_DISABLED');
  }

  for (const name of Object.keys(TOKEN_TTL_POLICIES) as TokenTtlName[]) {
    try {
      parseTokenTtlMilliseconds(name, env);
    } catch {
      issues.push(name);
    }
  }

  return issues;
}

export function assertAuthSecurityConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const issues = getAuthSecurityConfigIssues(env);
  if (issues.length > 0) {
    throw new Error(`Invalid production authentication security configuration: ${issues.join(', ')}`);
  }
}
