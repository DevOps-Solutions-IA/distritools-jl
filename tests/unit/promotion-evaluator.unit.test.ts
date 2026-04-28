import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PromotionEvaluatorService } from 'src/modules/promotions/domain/services/promotion-evaluator.service';
import { PromotionEntity } from 'src/modules/promotions/domain/entities/promotion.entity';

const evaluator = new PromotionEvaluatorService();

function promotion(overrides: Partial<Parameters<typeof PromotionEntity.fromState>[0]> = {}) {
  return PromotionEntity.fromState({
    id: overrides.id ?? 'promotion-1',
    productId: null,
    name: overrides.name ?? 'Promo',
    slug: overrides.slug ?? 'promo',
    description: null,
    type: overrides.type ?? 'percentage',
    scope: overrides.scope ?? 'line',
    stackingMode: overrides.stackingMode ?? 'exclusive',
    priority: overrides.priority ?? 10,
    value: overrides.value ?? '10.00',
    minSubtotal: overrides.minSubtotal ?? null,
    minQuantity: overrides.minQuantity ?? null,
    targetType: overrides.targetType ?? 'variant',
    targetIds: overrides.targetIds ?? ['variant-1'],
    isActive: overrides.isActive ?? true,
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('PromotionEvaluatorService', async () => {
  await it('aplica la promoción exclusiva de mayor prioridad de forma determinística', () => {
    const result = evaluator.evaluate(
      [
        promotion({ id: 'promo-low', priority: 5, value: '5.00' }),
        promotion({ id: 'promo-high', priority: 20, value: '15.00' }),
      ],
      [
        {
          variantId: 'variant-1',
          quantity: 1,
          unitPrice: '100.00',
        },
      ],
    );

    assert.equal(result.orderDiscountTotal, '15.00');
    assert.deepEqual(result.lineResults[0].appliedPromotionIds, ['promo-high']);
  });

  await it('permite stacking controlado en promociones de línea', () => {
    const result = evaluator.evaluate(
      [
        promotion({
          id: 'promo-a',
          stackingMode: 'stackable_same_scope',
          value: '10.00',
        }),
        promotion({
          id: 'promo-b',
          stackingMode: 'stackable_same_scope',
          value: '5.00',
        }),
      ],
      [
        {
          variantId: 'variant-1',
          quantity: 1,
          unitPrice: '100.00',
        },
      ],
    );

    assert.equal(result.orderDiscountTotal, '14.50');
    assert.deepEqual(result.lineResults[0].appliedPromotionIds, ['promo-a', 'promo-b']);
  });

  await it('ignora promociones inactivas o fuera de ventana', () => {
    const result = evaluator.evaluate(
      [
        promotion({
          id: 'inactive',
          isActive: false,
        }),
        promotion({
          id: 'future',
          startsAt: new Date(Date.now() + 86_400_000),
        }),
      ],
      [
        {
          variantId: 'variant-1',
          quantity: 1,
          unitPrice: '100.00',
        },
      ],
    );

    assert.equal(result.orderDiscountTotal, '0.00');
    assert.deepEqual(result.lineResults[0].appliedPromotionIds, []);
  });
});
