export interface OrderVariantReference {
  id: string;
  productId?: string | null;
  productIsActive?: boolean | null;
  productMetadata?: unknown | null;
  brandId?: string | null;
  brandIsActive?: boolean | null;
  categoryId?: string | null;
  categoryIsActive?: boolean | null;
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
