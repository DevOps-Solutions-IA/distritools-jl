import { createHash } from 'node:crypto';

export function syntheticSecret(label: string): string {
  return createHash('sha512').update(`test-only synthetic secret:${label}`).digest('base64url');
}
