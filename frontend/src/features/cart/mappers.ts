import type { CatalogProduct, CatalogVariant } from '@/features/catalog/types';
import type { AddCartItemPayload } from '@/features/cart/types';

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
    },
    availabilityLabel: product.availability.label,
    availabilityDescription: product.availability.description,
  };
}
