import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CategoriesController } from 'src/modules/categories/infrastructure/http/controllers/categories.controller';
import { CreateCategoryUseCase } from 'src/modules/categories/application/use-cases/create-category.use-case';
import { UpdateCategoryUseCase } from 'src/modules/categories/application/use-cases/update-category.use-case';
import { UpdateCategoryTreeUseCase } from 'src/modules/categories/application/use-cases/update-category-tree.use-case';
import { GetCategoryUseCase } from 'src/modules/categories/application/use-cases/get-category.use-case';
import { ListCategoriesUseCase } from 'src/modules/categories/application/use-cases/list-categories.use-case';
import { CategoryPolicyService } from 'src/modules/categories/domain/services/category-policy.service';
import {
  CATEGORY_REPOSITORY,
} from 'src/modules/categories/domain/repositories/category.repository';
import { PrismaCategoryRepository } from 'src/modules/categories/infrastructure/repositories/prisma-category.repository';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [
    CategoryPolicyService,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    UpdateCategoryTreeUseCase,
    GetCategoryUseCase,
    ListCategoriesUseCase,
    PrismaCategoryRepository,
    {
      provide: CATEGORY_REPOSITORY,
      useExisting: PrismaCategoryRepository,
    },
  ],
  exports: [CATEGORY_REPOSITORY, GetCategoryUseCase, ListCategoriesUseCase],
})
export class CategoriesModule {}
