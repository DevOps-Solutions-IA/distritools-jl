export interface InventoryVariantReference {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
}

export interface InventoryWarehouseReference {
  id: string;
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
