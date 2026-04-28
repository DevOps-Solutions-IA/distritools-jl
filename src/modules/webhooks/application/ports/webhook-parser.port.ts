import { ParsedWebhookPayload } from 'src/modules/payments/application/ports/payment-gateway.port';

export interface WebhookParserPort {
  parse(gateway: string, payload: string): ParsedWebhookPayload;
}

export const WEBHOOK_PARSER_PORT = Symbol('WEBHOOK_PARSER_PORT');
