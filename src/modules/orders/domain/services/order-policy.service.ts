import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderVariantReference } from 'src/modules/orders/domain/repositories/order-variant.repository';
import { OrderEntity } from 'src/modules/orders/domain/entities/order.entity';
import { evaluateCheckoutVariantSellability } from 'src/modules/products/domain/services/catalog-sellability.service';

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
        'No pudimos confirmar uno de los productos del carrito. Actualiza tu carrito e inténtalo de nuevo.',
      );
    }
  }

  ensureVariantSellable(variant: OrderVariantReference): void {
    const blockers = evaluateCheckoutVariantSellability(variant);
    if (blockers.length) {
      throw new BadRequestException(
        'Uno de los productos del carrito no está disponible para compra en este momento.',
      );
    }
  }

  ensureGuestVariantBelongsToProduct(
    variant: OrderVariantReference,
    productId: string,
  ): void {
    if (!variant.productId || variant.productId !== productId) {
      throw new UnprocessableEntityException(
        'No pudimos validar la selección de producto. Vuelve a agregarlo al carrito.',
      );
    }
  }

  ensureGuestVariantActive(variant: OrderVariantReference): void {
    const blockers = evaluateCheckoutVariantSellability(variant);
    if (blockers.length) {
      throw new UnprocessableEntityException(
        'Uno de los productos del carrito no está disponible para compra en este momento.',
      );
    }
  }

  ensureOrderExists(order: OrderEntity | null): asserts order is OrderEntity {
    if (!order) {
      throw new NotFoundException('Order not found');
    }
  }
}
