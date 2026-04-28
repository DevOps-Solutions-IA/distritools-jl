import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryState } from 'src/modules/categories/domain/entities/category.entity';

@Injectable()
export class CategoryPolicyService {
  normalizeName(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('Category name is required');
    }

    return normalized;
  }

  normalizeSlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Category slug is required');
    }

    return normalized;
  }

  ensureExists(category: CategoryState | null): CategoryState {
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  ensureSlugAvailable(existing: CategoryState | null, currentCategoryId?: string) {
    if (existing && existing.id !== currentCategoryId) {
      throw new ConflictException('Category slug already exists');
    }
  }

  ensureValidSortOrder(sortOrder: number) {
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new BadRequestException('Category sort order must be a non-negative integer');
    }
  }

  ensureValidParent(currentCategoryId: string, parent: CategoryState | null) {
    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }

    if (parent.id === currentCategoryId) {
      throw new BadRequestException('Category cannot be its own parent');
    }
  }

  ensureNoParentCycle(currentCategoryId: string, ancestry: CategoryState[]) {
    if (ancestry.some((category) => category.id === currentCategoryId)) {
      throw new BadRequestException('Category tree cycle detected');
    }
  }
}
