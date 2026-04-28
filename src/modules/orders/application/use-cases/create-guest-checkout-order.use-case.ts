import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
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
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: CreateGuestCheckoutOrderInput) {
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

    const resolvedLines = consolidatedItems.map((item) => {
      const candidate = (allocationMap.get(item.variantId) ?? []).find(
        (entry) => entry.availableQty >= item.quantity,
      );

      if (!candidate) {
        throw new ConflictException(
          `Insufficient stock for variant ${item.variantId}`,
        );
      }

      return {
        variantId: item.variantId,
        warehouseId: candidate.warehouseId,
        quantity: item.quantity,
      };
    });

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
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.auditRepository.write({
      action: 'checkout.guest_order_created',
      entityType: 'order',
      entityId: created.order.id,
      afterData: {
        orderId: created.order.id,
        orderNumber: created.order.orderNumber,
        status: created.order.status,
        paymentMethod: input.paymentMethod ?? null,
        deliveryMethod: input.deliveryMethod ?? null,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'checkout.guest_order_created',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        orderId: created.order.id,
        orderNumber: created.order.orderNumber,
        status: created.order.status,
        total: created.order.totals.grandTotal,
      },
    });

    return {
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      status: created.order.status,
      total: created.order.totals.grandTotal,
      currency: 'COP',
      payment: {
        canInitiate: true,
        initiateUrl: `/api/v1/payments/${created.order.orderNumber}/initiate`,
      },
    };
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
