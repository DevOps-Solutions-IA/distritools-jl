import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { OrderItemState } from 'src/modules/order-items/domain/entities/order-item.entity';

export interface CreateOrderItemRecord {
  id: string;
  orderId: string;
  variantId: string;
  warehouseId: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  unitPrice: string;
  taxRate: string;
  quantity: number;
  lineDiscountTotal: string;
  appliedPromotionIds?: unknown;
  lineSubtotal: string;
  lineTaxTotal: string;
  lineGrandTotal: string;
}

export interface OrderItemRepository {
  createMany(
    tx: PrismaTransactionClient,
    data: CreateOrderItemRecord[],
  ): Promise<OrderItemState[]>;
  findByOrderId(orderId: string, tx?: PrismaTransactionClient): Promise<OrderItemState[]>;
}

export const ORDER_ITEM_REPOSITORY = Symbol('ORDER_ITEM_REPOSITORY');
