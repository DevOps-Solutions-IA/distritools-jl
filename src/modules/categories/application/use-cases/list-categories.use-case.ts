import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { CategoryEntity } from 'src/modules/categories/domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from 'src/modules/categories/domain/repositories/category.repository';

export interface ListCategoriesInput {
  actor?: CurrentUser | null;
}

@Injectable()
export class ListCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: ListCategoriesInput = {}) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['categories.read']);
    }

    const categories = await this.categoryRepository.list({
      onlyActive: !input.actor,
    });

    return {
      data: categories.map((category) =>
        input.actor
          ? CategoryEntity.fromState(category).toAdminResponse()
          : CategoryEntity.fromState(category).toPublicResponse(),
      ),
    };
  }
}
