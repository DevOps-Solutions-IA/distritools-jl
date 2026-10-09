import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import {
  PaymentState,
  PaymentStatusValue,
} from 'src/modules/payments/domain/entities/payment.entity';

export interface CreatePaymentRecord {
  id: string;
  orderId: string;
  gateway: string;
  gatewayReference: string;
  amount: string;
  currency: string;
  status: PaymentStatusValue;
  expiresAt?: Date | null;
}

export interface UpdatePaymentRecord {
  id: string;
  status?: PaymentStatusValue;
  transactionId?: string | null;
  rawPayload?: unknown;
  confirmedAt?: Date | null;
  expiresAt?: Date | null;
}

export interface PaymentRepository {
  create(tx: PrismaTransactionClient, data: CreatePaymentRecord): Promise<PaymentState>;
  lockForUpdate(tx: PrismaTransactionClient, id: string): Promise<void>;
  findById(id: string, tx?: PrismaTransactionClient): Promise<PaymentState | null>;
  findByGatewayReference(
    gateway: string,
    gatewayReference: string,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentState | null>;
  findPendingByOrder(
    orderId: string,
    tx?: PrismaTransactionClient,
  ): Promise<PaymentState | null>;
  update(
    tx: PrismaTransactionClient,
    data: UpdatePaymentRecord,
  ): Promise<PaymentState>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
