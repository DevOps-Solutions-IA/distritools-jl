import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  ORDER_ITEM_REPOSITORY,
  OrderItemRepository,
} from 'src/modules/order-items/domain/repositories/order-item.repository';
import { OrderItemEntity } from 'src/modules/order-items/domain/entities/order-item.entity';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from 'src/modules/orders/domain/repositories/order.repository';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';
import { OrderPolicyService } from 'src/modules/orders/domain/services/order-policy.service';

export interface GetOrderInput {
  actor?: CurrentUser;
  orderNumber?: string;
  orderId?: string;
  adminView: boolean;
}

@Injectable()
export class GetOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(ORDER_ITEM_REPOSITORY)
    private readonly orderItemRepository: OrderItemRepository,
    @Inject(OrderPolicyService)
    private readonly orderPolicyService: OrderPolicyService,
  ) {}

  async execute(input: GetOrderInput) {
    if (input.adminView) {
      if (!input.actor) {
        throw new Error('Admin actor is required');
      }

      assertHasPermissions(input.actor.permissions, ['orders.read']);
    }

    const record = input.orderId
      ? await this.orderRepository.findById(input.orderId)
      : await this.orderRepository.findByOrderNumber(input.orderNumber!);
    const order = record ? OrderEntity.fromState(record) : null;
    this.orderPolicyService.ensureOrderExists(order);

    if (!input.adminView) {
      return order.toPublicResponse();
    }

    const items = await this.orderItemRepository.findByOrderId(order.id);

    return order.toAdminResponse(
      items.map((item) => OrderItemEntity.fromState(item).toResponse()),
    );
  }
}
