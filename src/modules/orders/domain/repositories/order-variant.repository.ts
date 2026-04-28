export interface OrderVariantReference {
  id: string;
  productId?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  sku: string;
  name: string;
  price: string;
  taxRate: string;
  isActive: boolean;
}

export interface OrderVariantRepository {
  findByIds(ids: string[]): Promise<OrderVariantReference[]>;
}

export const ORDER_VARIANT_REPOSITORY = Symbol('ORDER_VARIANT_REPOSITORY');
