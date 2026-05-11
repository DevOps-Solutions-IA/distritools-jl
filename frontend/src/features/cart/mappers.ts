import type { CatalogProduct, CatalogVariant } from '@/features/catalog/types';
import type { AddCartItemPayload } from '@/features/cart/types';
import { getProductCommerceState } from '@/features/catalog/commerce';

export function mapCatalogVariantToCartPayload(
  product: CatalogProduct,
  variant: CatalogVariant,
): AddCartItemPayload {
  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand?.name ?? null,
      categoryName: product.category?.name ?? null,
    },
    variant: {
      id: variant.id,
      productId: variant.productId,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      priceLabel: variant.priceLabel,
      taxRate: variant.taxRate,
      warehouseId: variant.warehouseId ?? null,
      mode: 'buy',
    },
    availabilityLabel: product.availability.label,
    availabilityDescription: product.availability.description,
  };
}

export function mapCatalogProductToQuoteCartPayload(product: CatalogProduct): AddCartItemPayload {
  const commerce = getProductCommerceState(product);

  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand?.name ?? null,
      categoryName: product.category?.name ?? null,
    },
    variant: {
      id: `quote-${product.id}`,
      productId: product.id,
      name: product.presentation ?? 'Cotización',
      sku: 'COTIZAR',
      price: 0,
      priceLabel: 'Por cotizar',
      taxRate: '0.00',
      warehouseId: null,
      mode: 'quote',
    },
    availabilityLabel: commerce.label,
    availabilityDescription: 'Confirmaremos precio y disponibilidad antes de finalizar.',
  };
}
