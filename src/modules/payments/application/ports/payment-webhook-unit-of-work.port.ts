import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export const PAYMENT_WEBHOOK_UNIT_OF_WORK = Symbol(
  'PAYMENT_WEBHOOK_UNIT_OF_WORK',
);

export interface PaymentWebhookUnitOfWork {
  run<T>(operation: (tx: PrismaTransactionClient) => Promise<T>): Promise<T>;
}
