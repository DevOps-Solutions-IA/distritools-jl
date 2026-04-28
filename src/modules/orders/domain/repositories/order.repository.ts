import { OrderStatus } from '@prisma/client';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { OrderState } from 'src/modules/orders/domain/entities/order.entity';

export interface CreateOrderRecord {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingNotes?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
}

export interface OrderRepository {
  create(tx: PrismaTransactionClient, data: CreateOrderRecord): Promise<OrderState>;
  findById(id: string, tx?: PrismaTransactionClient): Promise<OrderState | null>;
  findByOrderNumber(
    orderNumber: string,
    tx?: PrismaTransactionClient,
  ): Promise<OrderState | null>;
  updateStatus(
    tx: PrismaTransactionClient,
    id: string,
    status: OrderStatus,
  ): Promise<OrderState>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
