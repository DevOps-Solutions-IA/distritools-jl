import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PromotionEntity } from 'src/modules/promotions/domain/entities/promotion.entity';

export interface PromotionEvaluationLine {
  variantId: string;
  productId?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  quantity: number;
  unitPrice: string;
}

export interface PromotionLineResult {
  variantId: string;
  discountTotal: string;
  appliedPromotionIds: string[];
}

export interface PromotionEvaluationResult {
  orderDiscountTotal: string;
  lineResults: PromotionLineResult[];
  appliedCartPromotionIds: string[];
}

@Injectable()
export class PromotionEvaluatorService {
  evaluate(
    promotions: PromotionEntity[],
    lines: PromotionEvaluationLine[],
  ): PromotionEvaluationResult {
    const now = new Date();
    const activePromotions = promotions
      .filter((promotion) => promotion.isCurrentlyActive(now))
      .sort((left, right) =>
        right.priority - left.priority || left.id.localeCompare(right.id),
      );

    const lineResults = new Map<string, PromotionLineResult>();
    let cartDiscount = new Decimal(0);
    const cartSubtotal = lines.reduce(
      (accumulator, line) =>
        accumulator.add(new Decimal(line.unitPrice).mul(line.quantity)),
      new Decimal(0),
    );

    for (const line of lines) {
      const lineSubtotal = new Decimal(line.unitPrice).mul(line.quantity);
      const applicable = activePromotions.filter(
        (promotion) =>
          promotion.scope === 'line' &&
          this.matchesTarget(promotion, line) &&
          (promotion.minQuantity === null || line.quantity >= promotion.minQuantity),
      );

      const selected = this.selectDeterministic(applicable, lineSubtotal);
      lineResults.set(line.variantId, {
        variantId: line.variantId,
        discountTotal: selected.discountTotal.toFixed(2),
        appliedPromotionIds: selected.appliedPromotionIds,
      });
    }

    const cartPromotions = activePromotions.filter(
      (promotion) =>
        promotion.scope === 'cart' &&
        (promotion.minSubtotal === null || cartSubtotal.gte(promotion.minSubtotal)),
    );
    const selectedCart = this.selectDeterministic(cartPromotions, cartSubtotal);
    cartDiscount = selectedCart.discountTotal;

    const totalLineDiscount = Array.from(lineResults.values()).reduce(
      (accumulator, line) => accumulator.add(line.discountTotal),
      new Decimal(0),
    );

    return {
      orderDiscountTotal: totalLineDiscount.add(cartDiscount).toFixed(2),
      lineResults: Array.from(lineResults.values()),
      appliedCartPromotionIds: selectedCart.appliedPromotionIds,
    };
  }

  private selectDeterministic(
    promotions: PromotionEntity[],
    baseAmount: Decimal,
  ): { discountTotal: Decimal; appliedPromotionIds: string[] } {
    if (promotions.length === 0) {
      return {
        discountTotal: new Decimal(0),
        appliedPromotionIds: [],
      };
    }

    const [head, ...tail] = promotions;

    if (head.stackingMode === 'exclusive') {
      return {
        discountTotal: this.calculateDiscount(head, baseAmount),
        appliedPromotionIds: [head.id],
      };
    }

    const stackable = [head].concat(
      tail.filter((promotion) => promotion.stackingMode !== 'exclusive'),
    );

    let discount = new Decimal(0);
    const appliedPromotionIds: string[] = [];

    for (const promotion of stackable) {
      const increment = this.calculateDiscount(promotion, baseAmount.sub(discount));
      if (increment.lte(0)) {
        continue;
      }

      discount = discount.add(increment);
      appliedPromotionIds.push(promotion.id);
    }

    return {
      discountTotal: Decimal.min(discount, baseAmount),
      appliedPromotionIds,
    };
  }

  private matchesTarget(
    promotion: PromotionEntity,
    line: PromotionEvaluationLine,
  ): boolean {
    const targetIds = promotion.targetIds;

    switch (promotion.targetType) {
      case 'all':
        return true;
      case 'variant':
        return targetIds.includes(line.variantId);
      case 'product':
        return !!line.productId && targetIds.includes(line.productId);
      case 'category':
        return !!line.categoryId && targetIds.includes(line.categoryId);
      case 'brand':
        return !!line.brandId && targetIds.includes(line.brandId);
    }

    return false;
  }

  private calculateDiscount(
    promotion: PromotionEntity,
    baseAmount: Decimal,
  ): Decimal {
    if (promotion.type === 'percentage') {
      return Decimal.min(
        baseAmount.mul(promotion.value).div(100),
        baseAmount,
      );
    }

    return Decimal.min(new Decimal(promotion.value), baseAmount);
  }
}
