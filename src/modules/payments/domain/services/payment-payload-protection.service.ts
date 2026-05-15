import { Injectable } from '@nestjs/common';

const SENSITIVE_KEY_PATTERNS = [
  /email/i,
  /phone/i,
  /telefono/i,
  /document/i,
  /documento/i,
  /token/i,
  /secret/i,
  /password/i,
  /card/i,
  /tarjeta/i,
  /cvv/i,
  /pin/i,
  /customer/i,
  /cliente/i,
  /buyer/i,
  /comprador/i,
  /payer/i,
  /pagador/i,
  /fullName/i,
  /nombre/i,
  /address/i,
  /direccion/i,
];

@Injectable()
export class PaymentPayloadProtectionService {
  protect(payload: unknown): string {
    return '[REDACTED]';
  }

  redact(payload: unknown): string {
    return '[REDACTED]';
  }

  assertNoSecrets(payload: Record<string, unknown>): void {
    if (payload === null || typeof payload !== 'object') {
      return;
    }

    for (const key of Object.keys(payload)) {
      const hasSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) =>
        pattern.test(key),
      );

      if (hasSensitiveKey) {
        throw new Error(
          `Payment payload contains potentially sensitive key: "${key}". Use protect() before storing.`,
        );
      }

      const value = payload[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.assertNoSecrets(value as Record<string, unknown>);
      }
    }
  }
}
