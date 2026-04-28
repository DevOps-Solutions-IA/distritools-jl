import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { ProductEntity } from 'src/modules/products/domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from 'src/modules/products/domain/repositories/product.repository';

export interface ListProductsInput {
  actor?: CurrentUser | null;
  brandId?: string;
  categoryId?: string;
}

@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: ListProductsInput = {}) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['products.read']);
    }

    const products = await this.productRepository.list({
      onlyActive: !input.actor,
      brandId: input.brandId,
      categoryId: input.categoryId,
    });

    return {
      data: products.map((product) =>
        input.actor
          ? ProductEntity.fromState(product).toAdminResponse()
          : ProductEntity.fromState(product).toPublicResponse(),
      ),
    };
  }
}
