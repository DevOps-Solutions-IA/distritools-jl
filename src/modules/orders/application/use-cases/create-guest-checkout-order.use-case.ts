import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  InventoryAllocationCandidate,
  InventoryRepository,
} from 'src/modules/inventory/domain/repositories/inventory.repository';
import {
  ORDER_VARIANT_REPOSITORY,
  OrderVariantRepository,
} from 'src/modules/orders/domain/repositories/order-variant.repository';
import { CreateOrderUseCase } from 'src/modules/orders/application/use-cases/create-order.use-case';
import { OrderPolicyService } from 'src/modules/orders/domain/services/order-policy.service';
import { isPaymentMethodType } from 'src/modules/payments/domain/payment-methods';
import { AutoShippingService } from 'src/modules/shipping/application/services/auto-shipping.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { createOrderRequestIdentity } from 'src/modules/orders/application/services/order-request-idempotency';

export interface CreateGuestCheckoutOrderInput {
  customer: {
    fullName: string;
    email: string;
    phone: string;
    document?: string;
  };
  shippingAddress: {
    city: string;
    addressLine1: string;
    addressLine2?: string;
    notes?: string;
    department?: string;
    daneCode?: string;
  };
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
  deliveryMethod?: string;
  paymentMethod?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
  idempotencyKey?: string;
}

interface ConsolidatedGuestItem {
  productId: string;
  variantId: string;
  quantity: number;
}

@Injectable()
export class CreateGuestCheckoutOrderUseCase {
  constructor(
    @Inject(CreateOrderUseCase)
    private readonly createOrderUseCase: CreateOrderUseCase,
    @Inject(ORDER_VARIANT_REPOSITORY)
    private readonly orderVariantRepository: OrderVariantRepository,
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
    @Inject(OrderPolicyService)
    private readonly orderPolicyService: OrderPolicyService,
    @Inject(AutoShippingService)
    private readonly autoShippingService: AutoShippingService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateGuestCheckoutOrderInput) {
    const paymentMethod = input.paymentMethod ?? 'commercial_confirmation';
    const allowInternalGatewayTestMethod =
      process.env.NODE_ENV === 'test' && process.env.APP_ENV === 'test' && paymentMethod === 'mock';

    if (!isPaymentMethodType(paymentMethod) && !allowInternalGatewayTestMethod) {
      throw new BadRequestException('Unsupported payment method');
    }

    if (paymentMethod === 'pse') {
      throw new ConflictException('PSE provider is not configured');
    }

    const idempotencyIdentity = createOrderRequestIdentity(
      'checkout:guest',
      input.idempotencyKey,
      {
        customer: input.customer,
        shippingAddress: input.shippingAddress,
        items: input.items,
        deliveryMethod: input.deliveryMethod,
        paymentMethod,
        notes: input.notes,
      },
    );

    if (idempotencyIdentity) {
      const replay = await this.findIdempotentReplay(
        idempotencyIdentity,
        paymentMethod,
        allowInternalGatewayTestMethod,
      );
      if (replay) return replay;
    }

    const consolidatedItems = this.consolidateItems(input.items);
    const requestedVariantIds = consolidatedItems.map((item) => item.variantId);
    const variants = await this.orderVariantRepository.findByIds(requestedVariantIds);

    this.orderPolicyService.ensureVariantCatalogCompleteness(
      requestedVariantIds,
      variants,
    );

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    consolidatedItems.forEach((item) => {
      const variant = variantMap.get(item.variantId)!;
      this.orderPolicyService.ensureGuestVariantBelongsToProduct(
        variant,
        item.productId,
      );
      this.orderPolicyService.ensureGuestVariantActive(variant);
    });

    const allocationCandidates =
      await this.inventoryRepository.findAllocationCandidates(requestedVariantIds);
    const allocationMap = new Map<string, InventoryAllocationCandidate[]>();

    for (const candidate of allocationCandidates) {
      const current = allocationMap.get(candidate.variantId) ?? [];
      current.push(candidate);
      allocationMap.set(candidate.variantId, current);
    }

    const resolvedLines = [];
    for (const item of consolidatedItems) {
      const candidate = (allocationMap.get(item.variantId) ?? []).find(
        (entry) => entry.availableQty >= item.quantity,
      );

      if (!candidate) {
        if (idempotencyIdentity) {
          const replay = await this.findIdempotentReplay(
            idempotencyIdentity,
            paymentMethod,
            allowInternalGatewayTestMethod,
          );
          if (replay) return replay;
        }
        throw new ConflictException(
          `Insufficient stock for variant ${item.variantId}`,
        );
      }

      resolvedLines.push({
        variantId: item.variantId,
        warehouseId: candidate.warehouseId,
        quantity: item.quantity,
      });
    }

    const created = await this.createOrderUseCase.execute({
      customer: {
        fullName: input.customer.fullName,
        email: input.customer.email,
        phone: input.customer.phone,
      },
      shipping: {
        address: [
          input.shippingAddress.addressLine1.trim(),
          input.shippingAddress.addressLine2?.trim() ?? '',
        ]
          .filter(Boolean)
          .join(' | '),
        city: input.shippingAddress.city,
        notes: [
          input.shippingAddress.notes?.trim() ?? '',
          input.notes?.trim() ?? '',
          input.customer.document?.trim() ?? '',
          input.deliveryMethod?.trim() ?? '',
        ]
          .filter(Boolean)
          .join(' | ') || undefined,
        shippingTotal: 0,
      },
      items: resolvedLines,
      emitGuestCheckoutEvent: true,
      guestCheckoutAudit: {
        paymentMethod,
        deliveryMethod: input.deliveryMethod,
      },
      idempotencyIdentity,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    if (created.idempotentReplay) {
      const order = await this.prisma.order.findUnique({
        where: { id: created.order.id },
        include: { shipments: { orderBy: { createdAt: 'asc' } } },
      });
      if (!order) throw new ConflictException('Idempotent order record is inconsistent');
      return this.buildReplayResponse(order, paymentMethod, allowInternalGatewayTestMethod);
    }

    const autoShipping = await this.autoShippingService.runAfterCheckout({
      orderId: created.order.id,
      paymentMethod,
      customerDocument: input.customer.document,
      destinationDaneCode: input.shippingAddress.daneCode,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      trackingCode: created.trackingCode,
      status: created.order.status,
      total: created.order.totals.grandTotal,
      currency: 'COP',
      notification: {
        status: 'queued',
        channel: 'email',
      },
      payment: {
        canInitiate: allowInternalGatewayTestMethod,
        initiateUrl: allowInternalGatewayTestMethod
          ? `/api/v1/payments/${created.order.orderNumber}/initiate`
          : null,
      },
      shipping: {
        autoShippingStatus: autoShipping.status,
        carrier: autoShipping.carrier,
        guideNumber: autoShipping.guideNumber,
      },
    };
  }

  private buildReplayResponse(
    order: {
      id: string;
      orderNumber: string;
      status: string;
      grandTotal: { toFixed: (digits: number) => string };
      shipments: Array<{ status: string; trackingNumber: string | null; providerReference: string | null }>;
    },
    paymentMethod: string,
    allowInternalGatewayTestMethod: boolean,
  ) {
    const shipment = order.shipments.find((entry) => entry.trackingNumber) ?? order.shipments[0];
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingCode: `DTJL-TRK-${order.orderNumber.replace(/^DTJL-/, '')}`,
      status: order.status,
      total: order.grandTotal.toFixed(2),
      currency: 'COP',
      notification: { status: 'queued', channel: 'email' },
      payment: {
        canInitiate: allowInternalGatewayTestMethod,
        initiateUrl: allowInternalGatewayTestMethod
          ? `/api/v1/payments/${order.orderNumber}/initiate`
          : null,
      },
      shipping: {
        autoShippingStatus: shipment?.status ?? 'not_replayed',
        carrier: shipment?.providerReference ?? null,
        guideNumber: shipment?.trackingNumber ?? null,
      },
    };
  }

  private async findIdempotentReplay(
    identity: NonNullable<ReturnType<typeof createOrderRequestIdentity>>,
    paymentMethod: string,
    allowInternalGatewayTestMethod: boolean,
  ) {
    const existing = await this.prisma.orderRequestIdempotency.findUnique({
      where: { scope_keyHash: { scope: identity.scope, keyHash: identity.keyHash } },
    });
    if (!existing) return null;
    if (existing.fingerprint !== identity.fingerprint) {
      throw new ConflictException('Idempotency-Key was already used with a different request');
    }
    const order = await this.prisma.order.findUnique({
      where: { id: existing.orderId },
      include: { shipments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new ConflictException('Idempotent order record is inconsistent');
    return this.buildReplayResponse(order, paymentMethod, allowInternalGatewayTestMethod);
  }

  private consolidateItems(
    items: CreateGuestCheckoutOrderInput['items'],
  ): ConsolidatedGuestItem[] {
    const grouped = new Map<string, ConsolidatedGuestItem>();

    for (const item of items) {
      const key = `${item.productId}:${item.variantId}`;
      const current = grouped.get(key);

      if (current) {
        current.quantity += item.quantity;
        continue;
      }

      grouped.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    return [...grouped.values()].sort((left, right) =>
      `${left.productId}:${left.variantId}`.localeCompare(
        `${right.productId}:${right.variantId}`,
      ),
    );
  }
}
