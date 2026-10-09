import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface OrderRequestIdentity {
  scope: string;
  keyHash: string;
  fingerprint: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createOrderRequestIdentity(
  scope: string,
  rawKey: string | undefined,
  request: unknown,
): OrderRequestIdentity | undefined {
  if (rawKey === undefined) return undefined;

  const key = rawKey.trim();
  if (!/^[\x21-\x7e]{8,128}$/.test(key)) {
    throw new BadRequestException('Invalid Idempotency-Key');
  }

  return {
    scope,
    keyHash: sha256(key),
    fingerprint: sha256(JSON.stringify(stableValue(request))),
  };
}
