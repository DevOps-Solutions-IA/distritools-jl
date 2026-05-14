export interface InventoryVariantReference {
  id: string;
  productId: string | null;
  sku: string;
  name: string;
  isActive: boolean;
}

export interface InventoryWarehouseReference {
  id: string;
  code?: string;
  name: string;
  isActive: boolean;
}

export interface InventoryReferenceRepository {
  findVariantById(id: string): Promise<InventoryVariantReference | null>;
  findWarehouseById(id: string): Promise<InventoryWarehouseReference | null>;
}

export const INVENTORY_REFERENCE_REPOSITORY = Symbol(
  'INVENTORY_REFERENCE_REPOSITORY',
);
