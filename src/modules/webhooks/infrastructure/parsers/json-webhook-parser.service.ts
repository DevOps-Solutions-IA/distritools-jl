import { BadRequestException, Injectable } from '@nestjs/common';
import { ParsedWebhookPayload } from 'src/modules/payments/application/ports/payment-gateway.port';
import { WebhookParserPort } from 'src/modules/webhooks/application/ports/webhook-parser.port';

@Injectable()
export class JsonWebhookParserService implements WebhookParserPort {
  parse(_gateway: string, payload: string): ParsedWebhookPayload {
    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch {
      throw new BadRequestException('Invalid payment webhook payload');
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid payment webhook payload');
    }

    const parsed = value as Record<string, unknown>;
    const externalEventId = parsed.eventId;
    const gatewayReference = parsed.gatewayReference;
    const transactionId = parsed.transactionId;
    const status = parsed.status;

    if (
      typeof externalEventId !== 'string' || !externalEventId.trim() ||
      typeof gatewayReference !== 'string' || !gatewayReference.trim() ||
      (transactionId !== undefined && transactionId !== null && typeof transactionId !== 'string') ||
      !['approved', 'rejected', 'expired'].includes(String(status))
    ) {
      throw new BadRequestException('Invalid payment webhook payload');
    }

    return {
      externalEventId: externalEventId.trim(),
      gatewayReference: gatewayReference.trim(),
      transactionId: typeof transactionId === 'string' ? transactionId.trim() : undefined,
      status: status as ParsedWebhookPayload['status'],
      rawPayload: parsed,
    };
  }
}
