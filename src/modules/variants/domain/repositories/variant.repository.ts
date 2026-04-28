import { VariantState } from 'src/modules/variants/domain/entities/variant.entity';

export interface CreateVariantRecord {
  id: string;
  productId?: string | null;
  sku: string;
  name: string;
  price: string;
  taxRate?: string;
  isActive?: boolean;
}

export interface UpdateVariantRecord {
  id: string;
  productId?: string | null;
  sku?: string;
  name?: string;
  price?: string;
  taxRate?: string;
  isActive?: boolean;
}

export interface VariantRepository {
  create(data: CreateVariantRecord): Promise<VariantState>;
  update(data: UpdateVariantRecord): Promise<VariantState>;
  findById(id: string): Promise<VariantState | null>;
  findBySku(sku: string): Promise<VariantState | null>;
  list(options?: { onlyActive?: boolean; productId?: string }): Promise<VariantState[]>;
}

export const VARIANT_REPOSITORY = Symbol('VARIANT_REPOSITORY');
