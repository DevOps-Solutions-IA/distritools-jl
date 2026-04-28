import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { CategoryEntity } from 'src/modules/categories/domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from 'src/modules/categories/domain/repositories/category.repository';
import { CategoryPolicyService } from 'src/modules/categories/domain/services/category-policy.service';

export interface GetCategoryInput {
  categoryId: string;
  actor?: CurrentUser | null;
}

@Injectable()
export class GetCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
    @Inject(CategoryPolicyService)
    private readonly categoryPolicyService: CategoryPolicyService,
  ) {}

  async execute(input: GetCategoryInput) {
    const category = this.categoryPolicyService.ensureExists(
      await this.categoryRepository.findById(input.categoryId),
    );

    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['categories.read']);
      return CategoryEntity.fromState(category).toAdminResponse();
    }

    if (!category.isActive) {
      throw new NotFoundException('Category not found');
    }

    return CategoryEntity.fromState(category).toPublicResponse();
  }
}
