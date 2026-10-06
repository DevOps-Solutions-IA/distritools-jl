import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export const CREATE_ORDER_UNIT_OF_WORK = Symbol('CREATE_ORDER_UNIT_OF_WORK');

export interface CreateOrderUnitOfWork {
  run<T>(operation: (tx: PrismaTransactionClient) => Promise<T>): Promise<T>;
}
