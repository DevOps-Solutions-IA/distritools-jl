import { Prisma } from '@prisma/client';
import { BrandState } from 'src/modules/brands/domain/entities/brand.entity';

export interface CreateBrandRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  isActive?: boolean;
}

export interface UpdateBrandRecord {
  id: string;
  name?: string;
  slug?: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  isActive?: boolean;
}

export interface BrandRepository {
  create(data: CreateBrandRecord): Promise<BrandState>;
  update(data: UpdateBrandRecord): Promise<BrandState>;
  findById(id: string): Promise<BrandState | null>;
  findBySlug(slug: string): Promise<BrandState | null>;
  list(options?: { onlyActive?: boolean }): Promise<BrandState[]>;
}

export const BRAND_REPOSITORY = Symbol('BRAND_REPOSITORY');
