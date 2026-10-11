export interface InventoryOperationReadQuery {
  page: number;
  limit: number;
}

export interface InventoryOperationSummary {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryOperationPage {
  data: InventoryOperationSummary[];
  total: number;
}

export interface InventoryCountDetails extends InventoryOperationSummary {
  warehouse: { id: string; code: string; name: string; isActive: boolean };
  lines: Array<{
    id: string;
    variantId: string;
    sku: string;
    systemQuantity: number;
    countedQuantity: number | null;
    difference: number | null;
    adjustmentMovementId: string | null;
  }>;
}

export interface InventoryImportDetails extends InventoryOperationSummary {
  rows: Array<{
    id: string;
    rowNumber: number;
    sku: string;
    warehouseCode: string;
    quantity: number;
    mode: string;
    reason: string;
    valid: boolean;
    errors: unknown;
  }>;
}

export interface InventoryOperationReadRepository {
  listCounts(query: InventoryOperationReadQuery): Promise<InventoryOperationPage>;
  findCount(id: string): Promise<InventoryCountDetails | null>;
  listImports(query: InventoryOperationReadQuery): Promise<InventoryOperationPage>;
  findImport(id: string): Promise<InventoryImportDetails | null>;
}

export const INVENTORY_OPERATION_READ_REPOSITORY = Symbol('INVENTORY_OPERATION_READ_REPOSITORY');
