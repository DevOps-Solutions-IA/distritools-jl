import { Decimal } from '@prisma/client/runtime/library';
import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  CREATE_ORDER_UNIT_OF_WORK,
  CreateOrderUnitOfWork,
} from 'src/modules/orders/application/ports/create-order-unit-of-work.port';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import {
  ORDER_ITEM_REPOSITORY,
  OrderItemRepository,
} from 'src/modules/order-items/domain/repositories/order-item.repository';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from 'src/modules/orders/domain/repositories/order.repository';
import {
  ORDER_VARIANT_REPOSITORY,
  OrderVariantRepository,
} from 'src/modules/orders/domain/repositories/order-variant.repository';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';
import { OrderNumberService } from 'src/modules/orders/domain/services/order-number.service';
import { OrderPolicyService } from 'src/modules/orders/domain/services/order-policy.service';
import { OrderTrackingCodeService } from 'src/modules/orders/domain/services/order-tracking-code.service';
import { OrderStatus } from '@prisma/client';
import { OrderItemEntity } from 'src/modules/order-items/domain/entities/order-item.entity';
import { EvaluatePromotionsUseCase } from 'src/modules/promotions/application/use-cases/evaluate-promotions.use-case';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';

export interface CreateOrderLineInput {
  variantId: string;
  warehouseId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customer: {
    fullName: string;
    email: string;
    phone: string;
  };
  shipping: {
    address: string;
    city: string;
    notes?: string;
    shippingTotal?: number;
  };
  items: CreateOrderLineInput[];
  emitGuestCheckoutEvent?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(CREATE_ORDER_UNIT_OF_WORK)
    private readonly createOrderUnitOfWork: CreateOrderUnitOfWork,
    @Inject(ORDER_VARIANT_REPOSITORY)
    private readonly orderVariantRepository: OrderVariantRepository,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(ORDER_ITEM_REPOSITORY)
    private readonly orderItemRepository: OrderItemRepository,
    @Inject(ReserveStockUseCase)
    private readonly reserveStockUseCase: ReserveStockUseCase,
    @Inject(OrderNumberService)
    private readonly orderNumberService: OrderNumberService,
    @Inject(OrderPolicyService)
    private readonly orderPolicyService: OrderPolicyService,
    @Inject(OrderTrackingCodeService)
    private readonly orderTrackingCodeService: OrderTrackingCodeService,
    @Inject(EvaluatePromotionsUseCase)
    private readonly evaluatePromotionsUseCase: EvaluatePromotionsUseCase,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(input: CreateOrderInput) {
    const orderId = uuidv7();
    const orderNumber = this.orderNumberService.generate();
    const trackingCode = this.orderTrackingCodeService.create(orderNumber);
    const requestedVariantIds = [...new Set(input.items.map((item) => item.variantId))];
    const variants = await this.orderVariantRepository.findByIds(requestedVariantIds);

    this.orderPolicyService.ensureVariantCatalogCompleteness(
      requestedVariantIds,
      variants,
    );

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const shippingTotal = new Decimal(input.shipping.shippingTotal ?? 0);
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const promotionEvaluation = await this.evaluatePromotionsUseCase.execute(
      input.items.map((item) => {
        const variant = variantMap.get(item.variantId)!;

        return {
          variantId: item.variantId,
          productId: variant.productId,
          brandId: variant.brandId,
          categoryId: variant.categoryId,
          quantity: item.quantity,
          unitPrice: variant.price,
        };
      }),
    );
    const promotionLineMap = new Map(
      promotionEvaluation.lineResults.map((line) => [line.variantId, line]),
    );

    const orderItemDrafts = input.items.map((item) => {
      const variant = variantMap.get(item.variantId)!;
      this.orderPolicyService.ensureVariantSellable(variant);

      const unitPrice = new Decimal(variant.price);
      const taxRate = new Decimal(variant.taxRate);
      const quantity = new Decimal(item.quantity);
      const linePromotion = promotionLineMap.get(item.variantId);
      const lineDiscountTotal = new Decimal(linePromotion?.discountTotal ?? 0);
      const lineSubtotal = unitPrice.mul(quantity);
      const taxableBase = Decimal.max(lineSubtotal.sub(lineDiscountTotal), new Decimal(0));
      const lineTaxTotal = taxableBase.mul(taxRate).div(100);
      const lineGrandTotal = taxableBase.add(lineTaxTotal);

      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(lineTaxTotal);

      return {
        id: uuidv7(),
        orderId,
        variantId: variant.id,
        warehouseId: item.warehouseId,
        variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        unitPrice: unitPrice.toFixed(2),
        taxRate: taxRate.toFixed(2),
        quantity: item.quantity,
        lineDiscountTotal: lineDiscountTotal.toFixed(2),
        appliedPromotionIds: linePromotion?.appliedPromotionIds ?? [],
        lineSubtotal: lineSubtotal.toFixed(2),
        lineTaxTotal: lineTaxTotal.toFixed(2),
        lineGrandTotal: lineGrandTotal.toFixed(2),
      };
    });

    const discountTotal = new Decimal(promotionEvaluation.orderDiscountTotal);
    const grandTotal = subtotal.sub(discountTotal).add(taxTotal).add(shippingTotal);

    const order = await this.createOrderUnitOfWork.run(async (tx) => {
      await this.reserveStockUseCase.execute({
        referenceType: 'order',
        referenceId: orderId,
        reason: 'Order creation reservation',
        lines: input.items.map((item) => ({
          variantId: item.variantId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
        })),
        tx,
      });

      const createdOrder = await this.orderRepository.create(tx, {
        id: orderId,
        orderNumber,
        status: OrderStatus.pending_payment,
        customerName: input.customer.fullName.trim(),
        customerEmail: input.customer.email.trim().toLowerCase(),
        customerPhone: input.customer.phone.trim(),
        shippingAddress: input.shipping.address.trim(),
        shippingCity: input.shipping.city.trim(),
        shippingNotes: input.shipping.notes?.trim() || null,
        subtotal: subtotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        shippingTotal: shippingTotal.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
      });

      const createdItems = await this.orderItemRepository.createMany(
        tx,
        orderItemDrafts,
      );

      const event = await this.outbox.captureHeld(tx, {
        eventName: 'order.created', eventVersion: 'v1', occurredAt: new Date().toISOString(),
        payload: {
          orderId: createdOrder.id, orderNumber: createdOrder.orderNumber, trackingCode,
          status: createdOrder.status,
          totals: { subtotal: createdOrder.subtotal, discountTotal: createdOrder.discountTotal,
            taxTotal: createdOrder.taxTotal, shippingTotal: createdOrder.shippingTotal, grandTotal: createdOrder.grandTotal },
          customerEmail: createdOrder.customerEmail, customerPhone: createdOrder.customerPhone,
          items: createdItems.map((item) => ({ sku: item.skuSnapshot, name: item.variantNameSnapshot,
            quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineGrandTotal })),
        },
      });

      const guestCheckoutEvent = input.emitGuestCheckoutEvent ? await this.outbox.captureHeld(tx, {
        eventName: 'checkout.guest_order_created', eventVersion: 'v1', occurredAt: new Date().toISOString(),
        payload: { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber,
          status: createdOrder.status, total: createdOrder.grandTotal },
      }) : undefined;

      return {
        order: createdOrder,
        items: createdItems,
        event,
        guestCheckoutEvent,
      };
    });

    const orderEntity = OrderEntity.fromState(order.order);
    orderEntity.ensureTotalsConsistency();

    await this.auditRepository.write({
      action: 'order.created',
      entityType: 'order',
      entityId: order.order.id,
      afterData: {
        order: order.order,
        items: order.items,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(order.event, order.event.route);
    if (order.guestCheckoutEvent) {
      await this.domainEventPublisher.publish(order.guestCheckoutEvent, order.guestCheckoutEvent.route);
    }

    return {
      order: orderEntity.toAdminResponse(
        order.items.map((item) => OrderItemEntity.fromState(item).toResponse()),
      ),
      trackingCode,
    };
  }
}
