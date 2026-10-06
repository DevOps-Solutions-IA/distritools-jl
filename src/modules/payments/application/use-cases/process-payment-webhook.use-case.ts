import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
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
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from 'src/modules/payments/domain/repositories/payment.repository';
import {
  PaymentEntity,
  PaymentStatusValue,
} from 'src/modules/payments/domain/entities/payment.entity';
import { PaymentPolicyService } from 'src/modules/payments/domain/services/payment-policy.service';
import { PaymentPayloadProtectionService } from 'src/modules/payments/domain/services/payment-payload-protection.service';
import {
  PAYMENT_WEBHOOK_UNIT_OF_WORK,
  PaymentWebhookUnitOfWork,
} from 'src/modules/payments/application/ports/payment-webhook-unit-of-work.port';
import {
  WEBHOOK_PARSER_PORT,
  WebhookParserPort,
} from 'src/modules/webhooks/application/ports/webhook-parser.port';
import {
  WEBHOOK_SIGNATURE_PORT,
  WebhookSignaturePort,
} from 'src/modules/webhooks/application/ports/webhook-signature.port';
import {
  WEBHOOK_RECEIPT_REPOSITORY,
  WebhookReceiptRepository,
} from 'src/modules/webhooks/domain/repositories/webhook-receipt.repository';
import { OrderStatus } from '@prisma/client';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository, PersistedDomainEvent } from 'src/common/events/domain-event-outbox.port';

export interface ProcessPaymentWebhookInput {
  gateway: string;
  signature?: string;
  payload: string;
}

@Injectable()
export class ProcessPaymentWebhookUseCase {
  constructor(
    @Inject(PAYMENT_WEBHOOK_UNIT_OF_WORK)
    private readonly unitOfWork: PaymentWebhookUnitOfWork,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(ORDER_ITEM_REPOSITORY)
    private readonly orderItemRepository: OrderItemRepository,
    @Inject(CommitStockUseCase)
    private readonly commitStockUseCase: CommitStockUseCase,
    @Inject(ReleaseStockUseCase)
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    @Inject(PaymentPayloadProtectionService)
    private readonly payloadProtection: PaymentPayloadProtectionService,
    @Inject(PaymentPolicyService)
    private readonly paymentPolicyService: PaymentPolicyService,
    @Inject(WEBHOOK_SIGNATURE_PORT)
    private readonly webhookSignaturePort: WebhookSignaturePort,
    @Inject(WEBHOOK_PARSER_PORT)
    private readonly webhookParserPort: WebhookParserPort,
    @Inject(WEBHOOK_RECEIPT_REPOSITORY)
    private readonly webhookReceiptRepository: WebhookReceiptRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(input: ProcessPaymentWebhookInput) {
    const validSignature = this.webhookSignaturePort.verify({
      gateway: input.gateway,
      signature: input.signature,
      payload: input.payload,
    });

    if (!validSignature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const parsed = this.webhookParserPort.parse(input.gateway, input.payload);

    const receiptId = uuidv7();

    const { events, ...result } = await this.unitOfWork.run(async (tx) => {
      const receiptRegistration =
        await this.webhookReceiptRepository.createIfAbsent(tx, {
          id: receiptId,
          gateway: input.gateway,
          externalEventId: parsed.externalEventId,
          signature: input.signature ?? null,
          payload: parsed.rawPayload,
        });

      if (!receiptRegistration.inserted) {
        return { idempotent: true as const, payment: null, order: null, events: [] as PersistedDomainEvent[] };
      }

      const paymentRecord = await this.paymentRepository.findByGatewayReference(
        input.gateway,
        parsed.gatewayReference,
        tx,
      );
      const payment = paymentRecord ? PaymentEntity.fromState(paymentRecord) : null;
      this.paymentPolicyService.ensurePaymentExists(payment);
      payment.ensureFinalizable();

      const orderRecord = await this.orderRepository.findById(payment.orderId, tx);
      const order = orderRecord ? OrderEntity.fromState(orderRecord) : null;
      this.paymentPolicyService.ensureOrderExists(order);
      const orderItems = await this.orderItemRepository.findByOrderId(order.id, tx);

      let updatedPaymentStatus: PaymentStatusValue;
      let updatedOrderStatus: OrderStatus;

      if (parsed.status === 'approved') {
        await this.commitStockUseCase.execute({
          referenceType: 'order',
          referenceId: order.id,
          reason: 'Payment approved webhook',
          lines: orderItems.map((item) => ({
            variantId: item.variantId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
          })),
          tx,
        });
        updatedPaymentStatus = 'approved';
        updatedOrderStatus = OrderStatus.paid;
      } else {
        await this.releaseStockUseCase.execute({
          referenceType: 'order',
          referenceId: order.id,
          reason:
            parsed.status === 'expired'
              ? 'Payment expired webhook'
              : 'Payment rejected webhook',
          lines: orderItems.map((item) => ({
            variantId: item.variantId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
          })),
          tx,
        });
        updatedPaymentStatus = parsed.status === 'expired' ? 'expired' : 'rejected';
        updatedOrderStatus = OrderStatus.cancelled;
      }

      const updatedPayment = await this.paymentRepository.update(tx, {
        id: payment.id,
        status: updatedPaymentStatus,
        transactionId: parsed.transactionId ?? null,
        rawPayload: this.payloadProtection.protect(parsed.rawPayload),
        confirmedAt: parsed.status === 'approved' ? new Date() : null,
      });
      const updatedOrder = await this.orderRepository.updateStatus(
        tx,
        order.id,
        updatedOrderStatus,
      );

      const events: PersistedDomainEvent[] = [await this.outbox.captureHeld(tx, {
        eventName: updatedPayment.status === 'approved' ? 'payment.approved'
          : updatedPayment.status === 'expired' ? 'payment.expired' : 'payment.rejected',
        eventVersion: 'v1', occurredAt: new Date().toISOString(),
        payload: { paymentId: updatedPayment.id, orderId: updatedOrder.id, orderNumber: updatedOrder.orderNumber,
          status: updatedPayment.status, gatewayReference: updatedPayment.gatewayReference,
          customerEmail: updatedOrder.customerEmail, customerPhone: updatedOrder.customerPhone },
      })];
      if (updatedPayment.status === 'approved') {
        events.push(await this.outbox.captureHeld(tx, {
          eventName: 'order.paid', eventVersion: 'v1', occurredAt: new Date().toISOString(),
          payload: { orderId: updatedOrder.id, orderNumber: updatedOrder.orderNumber,
            customerEmail: updatedOrder.customerEmail, customerPhone: updatedOrder.customerPhone },
        }));
      }

      await this.webhookReceiptRepository.markProcessed(tx, receiptRegistration.receipt.id);

      return {
        idempotent: false as const,
        payment: updatedPayment,
        order: updatedOrder,
        events,
      };
    });

    if (result.idempotent) {
      return { ok: true, idempotent: true };
    }

    await this.auditRepository.write({
      action: 'payment.webhook_processed',
      entityType: 'payment',
      entityId: result.payment!.id,
      afterData: result,
    });

    for (const event of events) await this.domainEventPublisher.publish(event);

    return {
      ok: true,
      idempotent: false,
      payment: result.payment,
      order: result.order,
    };
  }
}
