import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { VariantEntity } from 'src/modules/variants/domain/entities/variant.entity';
import {
  VARIANT_REPOSITORY,
  VariantRepository,
} from 'src/modules/variants/domain/repositories/variant.repository';

export interface ListVariantsInput {
  actor?: CurrentUser | null;
  productId?: string;
}

@Injectable()
export class ListVariantsUseCase {
  constructor(
    @Inject(VARIANT_REPOSITORY)
    private readonly variantRepository: VariantRepository,
  ) {}

  async execute(input: ListVariantsInput = {}) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['variants.read']);
    }

    const variants = await this.variantRepository.list({
      onlyActive: !input.actor,
      productId: input.productId,
    });

    return {
      data: variants
        .filter((variant) => input.actor || !variant.product || variant.product.isActive)
        .map((variant) =>
          input.actor
            ? VariantEntity.fromState(variant).toAdminResponse()
            : VariantEntity.fromState(variant).toPublicResponse(),
        ),
    };
  }
}
