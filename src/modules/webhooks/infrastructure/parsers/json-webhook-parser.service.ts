import { Injectable } from '@nestjs/common';
import { ParsedWebhookPayload } from 'src/modules/payments/application/ports/payment-gateway.port';
import { WebhookParserPort } from 'src/modules/webhooks/application/ports/webhook-parser.port';

@Injectable()
export class JsonWebhookParserService implements WebhookParserPort {
  parse(_gateway: string, payload: string): ParsedWebhookPayload {
    const parsed = JSON.parse(payload) as {
      eventId: string;
      gatewayReference: string;
      transactionId?: string;
      status: 'approved' | 'rejected' | 'expired';
    };

    return {
      externalEventId: parsed.eventId,
      gatewayReference: parsed.gatewayReference,
      transactionId: parsed.transactionId,
      status: parsed.status,
      rawPayload: parsed,
    };
  }
}
