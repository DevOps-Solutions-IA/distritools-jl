import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import {
  ORDER_ITEM_REPOSITORY,
  OrderItemRepository,
} from 'src/modules/order-items/domain/repositories/order-item.repository';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from 'src/modules/orders/domain/repositories/order.repository';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';
import { OrderPolicyService } from 'src/modules/orders/domain/services/order-policy.service';
import { OrderStatus } from '@prisma/client';

export interface CancelOrderInput {
  actor?: CurrentUser;
  orderNumber: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(ORDER_ITEM_REPOSITORY)
    private readonly orderItemRepository: OrderItemRepository,
    @Inject(ReleaseStockUseCase)
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    @Inject(OrderPolicyService)
    private readonly orderPolicyService: OrderPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: CancelOrderInput) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['orders.cancel']);
    }

    const orderRecord = await this.orderRepository.findByOrderNumber(input.orderNumber);
    const order = orderRecord ? OrderEntity.fromState(orderRecord) : null;
    this.orderPolicyService.ensureOrderExists(order);
    order.ensureCanCancel();

    const orderItems = await this.orderItemRepository.findByOrderId(order.id);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await this.releaseStockUseCase.execute({
        actor: input.actor,
        referenceType: 'order',
        referenceId: order.id,
        reason: input.reason ?? 'Order cancellation',
        lines: orderItems.map((item) => ({
          variantId: item.variantId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
        })),
        tx,
      });

      return this.orderRepository.updateStatus(tx, order.id, OrderStatus.cancelled);
    });

    await this.auditRepository.write({
      actorUserId: input.actor?.sub,
      action: 'order.cancelled',
      entityType: 'order',
      entityId: updatedOrder.id,
      beforeData: orderRecord,
      afterData: updatedOrder,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'order.cancelled',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        customerEmail: updatedOrder.customerEmail,
        customerPhone: updatedOrder.customerPhone,
      },
    });

    return OrderEntity.fromState(updatedOrder).toPublicResponse();
  }
}
