import { Prisma } from '@prisma/client';
import { ProductState } from 'src/modules/products/domain/entities/product.entity';

export interface CreateProductRecord {
  id: string;
  brandId?: string | null;
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  isActive?: boolean;
}

export interface UpdateProductRecord {
  id: string;
  brandId?: string | null;
  categoryId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  isActive?: boolean;
}

export interface ProductRepository {
  create(data: CreateProductRecord): Promise<ProductState>;
  update(data: UpdateProductRecord): Promise<ProductState>;
  findById(id: string): Promise<ProductState | null>;
  findBySlug(slug: string): Promise<ProductState | null>;
  list(options?: { onlyActive?: boolean; brandId?: string; categoryId?: string }): Promise<ProductState[]>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
