import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from 'src/modules/orders/domain/repositories/order.repository';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';
import {
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
} from 'src/modules/payments/application/ports/payment-gateway.port';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from 'src/modules/payments/domain/repositories/payment.repository';
import { PaymentPolicyService } from 'src/modules/payments/domain/services/payment-policy.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export interface CreatePaymentIntentInput {
  actor?: CurrentUser;
  orderNumber: string;
  gateway: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreatePaymentIntentUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
    @Inject(PaymentPolicyService)
    private readonly paymentPolicyService: PaymentPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(input: CreatePaymentIntentInput) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['payments.create']);
    }

    if (input.gateway === 'pse') {
      throw new ConflictException('PSE provider is not configured');
    }

    if (input.gateway !== 'mock') {
      throw new BadRequestException('Unsupported payment gateway');
    }

    const orderRecord = await this.orderRepository.findByOrderNumber(input.orderNumber);
    const order = orderRecord ? OrderEntity.fromState(orderRecord) : null;
    this.paymentPolicyService.ensureOrderExists(order);

    if (order.status !== 'pending_payment') {
      throw new ConflictException(
        'Payment can only be initiated for pending_payment orders',
      );
    }

    const paymentId = uuidv7();
    const intent = await this.paymentGateway.createIntent({
      paymentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: orderRecord!.grandTotal,
      currency: 'COP',
    });

    const { payment, event } = await this.prisma.$transaction(async (tx) => {
      const payment = await this.paymentRepository.create(tx, {
        id: paymentId,
        orderId: order.id,
        gateway: input.gateway,
        gatewayReference: intent.gatewayReference,
        amount: orderRecord!.grandTotal,
        currency: 'COP',
        status: 'pending',
        expiresAt: intent.expiresAt,
      });
      const event = await this.outbox.captureHeld(tx as unknown as PrismaTransactionClient, {
        eventName: 'payment.intent_created', eventVersion: 'v1', occurredAt: new Date().toISOString(),
        payload: {
          paymentId: payment.id, orderId: payment.orderId, gateway: payment.gateway,
          gatewayReference: payment.gatewayReference, status: payment.status,
        },
      });
      return { payment, event };
    });

    await this.auditRepository.write({
      actorUserId: input.actor?.sub,
      action: 'payment.intent_created',
      entityType: 'payment',
      entityId: payment.id,
      afterData: payment,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return {
      payment: {
        ...payment,
        checkoutUrl: intent.checkoutUrl,
      },
    };
  }
}
