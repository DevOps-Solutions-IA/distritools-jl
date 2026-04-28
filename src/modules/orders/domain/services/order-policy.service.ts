import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderVariantReference } from 'src/modules/orders/domain/repositories/order-variant.repository';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';

@Injectable()
export class OrderPolicyService {
  ensureVariantCatalogCompleteness(
    requestedVariantIds: string[],
    variants: OrderVariantReference[],
  ): void {
    const existing = new Set(variants.map((variant) => variant.id));
    const missing = requestedVariantIds.filter((variantId) => !existing.has(variantId));

    if (missing.length > 0) {
      throw new NotFoundException(
        `Missing variants for order: ${missing.join(', ')}`,
      );
    }
  }

  ensureVariantSellable(variant: OrderVariantReference): void {
    if (!variant.isActive) {
      throw new BadRequestException(`Variant ${variant.id} is inactive`);
    }
  }

  ensureGuestVariantBelongsToProduct(
    variant: OrderVariantReference,
    productId: string,
  ): void {
    if (!variant.productId || variant.productId !== productId) {
      throw new UnprocessableEntityException(
        `Variant ${variant.id} does not belong to product ${productId}`,
      );
    }
  }

  ensureGuestVariantActive(variant: OrderVariantReference): void {
    if (!variant.isActive) {
      throw new UnprocessableEntityException(`Variant ${variant.id} is inactive`);
    }
  }

  ensureOrderExists(order: OrderEntity | null): asserts order is OrderEntity {
    if (!order) {
      throw new NotFoundException('Order not found');
    }
  }
}
