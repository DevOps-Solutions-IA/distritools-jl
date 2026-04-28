import { CategoryState } from 'src/modules/categories/domain/entities/category.entity';

export interface CreateCategoryRecord {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateCategoryRecord {
  id: string;
  parentId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CategoryRepository {
  create(data: CreateCategoryRecord): Promise<CategoryState>;
  update(data: UpdateCategoryRecord): Promise<CategoryState>;
  findById(id: string): Promise<CategoryState | null>;
  findBySlug(slug: string): Promise<CategoryState | null>;
  list(options?: { onlyActive?: boolean }): Promise<CategoryState[]>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
