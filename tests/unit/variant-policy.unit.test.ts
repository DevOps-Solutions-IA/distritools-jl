import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VariantPolicyService } from 'src/modules/variants/domain/services/variant-policy.service';

describe('VariantPolicyService', async () => {
  const service = new VariantPolicyService();

  await it('normaliza SKU y rechaza precios inválidos', () => {
    assert.equal(service.normalizeSku(' sku-100 '), 'SKU-100');
    assert.equal(service.ensurePrice('99.9'), '99.90');
    assert.throws(() => service.ensurePrice('0'), /greater than zero/i);
  });

  await it('rechaza variantes no vendibles cuando producto o variante están inactivos', () => {
    assert.throws(
      () =>
        service.ensureSellable({
          id: 'variant-1',
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Variant 1',
          price: '10.00',
          taxRate: '19.00',
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: null,
        }),
      /not active/i,
    );

    assert.throws(
      () =>
        service.ensureSellable({
          id: 'variant-2',
          productId: 'product-2',
          sku: 'SKU-2',
          name: 'Variant 2',
          price: '10.00',
          taxRate: '19.00',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'product-2',
            name: 'Product',
            slug: 'product',
            isActive: false,
            brand: null,
            category: null,
          },
        }),
      /product is not active/i,
    );
  });
});
