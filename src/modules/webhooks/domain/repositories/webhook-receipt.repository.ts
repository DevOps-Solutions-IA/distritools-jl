import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { WebhookReceiptState } from 'src/modules/webhooks/domain/entities/webhook-receipt.entity';

export interface CreateWebhookReceiptRecord {
  id: string;
  gateway: string;
  externalEventId: string;
  signature?: string | null;
  payload: unknown;
}

export interface WebhookReceiptRepository {
  findByGatewayAndEventId(
    tx: PrismaTransactionClient,
    gateway: string,
    externalEventId: string,
  ): Promise<WebhookReceiptState | null>;
  createIfAbsent(
    tx: PrismaTransactionClient,
    data: CreateWebhookReceiptRecord,
  ): Promise<{
    receipt: WebhookReceiptState;
    inserted: boolean;
  }>;
  markProcessed(
    tx: PrismaTransactionClient,
    id: string,
  ): Promise<WebhookReceiptState>;
}

export const WEBHOOK_RECEIPT_REPOSITORY = Symbol('WEBHOOK_RECEIPT_REPOSITORY');
