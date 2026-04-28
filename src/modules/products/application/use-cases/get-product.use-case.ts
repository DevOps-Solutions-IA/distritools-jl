import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { ProductEntity } from 'src/modules/products/domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from 'src/modules/products/domain/repositories/product.repository';
import { ProductPolicyService } from 'src/modules/products/domain/services/product-policy.service';

export interface GetProductInput {
  productId: string;
  actor?: CurrentUser | null;
}

@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
    @Inject(ProductPolicyService)
    private readonly productPolicyService: ProductPolicyService,
  ) {}

  async execute(input: GetProductInput) {
    const product = this.productPolicyService.ensureExists(
      await this.productRepository.findById(input.productId),
    );

    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['products.read']);
      return ProductEntity.fromState(product).toAdminResponse();
    }

    if (!product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return ProductEntity.fromState(product).toPublicResponse();
  }
}
