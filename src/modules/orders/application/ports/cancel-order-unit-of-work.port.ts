import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export const CANCEL_ORDER_UNIT_OF_WORK = Symbol('CANCEL_ORDER_UNIT_OF_WORK');

export interface CancelOrderUnitOfWork {
  run<T>(operation: (tx: PrismaTransactionClient) => Promise<T>): Promise<T>;
}
