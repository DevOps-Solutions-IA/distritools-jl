import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';
import { PaymentEntity } from 'src/modules/payments/domain/entities/payment.entity';

@Injectable()
export class PaymentPolicyService {
  ensureOrderExists(order: OrderEntity | null): asserts order is OrderEntity {
    if (!order) {
      throw new NotFoundException('Order not found');
    }
  }

  ensurePaymentExists(
    payment: PaymentEntity | null,
  ): asserts payment is PaymentEntity {
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
  }
}
