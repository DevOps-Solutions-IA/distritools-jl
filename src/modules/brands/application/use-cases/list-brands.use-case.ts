import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { BrandEntity } from 'src/modules/brands/domain/entities/brand.entity';
import {
  BRAND_REPOSITORY,
  BrandRepository,
} from 'src/modules/brands/domain/repositories/brand.repository';

export interface ListBrandsInput {
  actor?: CurrentUser | null;
}

@Injectable()
export class ListBrandsUseCase {
  constructor(
    @Inject(BRAND_REPOSITORY)
    private readonly brandRepository: BrandRepository,
  ) {}

  async execute(input: ListBrandsInput = {}) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['brands.read']);
    }

    const brands = await this.brandRepository.list({
      onlyActive: !input.actor,
    });
    const sortedBrands = [...brands].sort((left, right) => {
      const leftPriority = Number((left.metadata as { commercialPriority?: number } | null)?.commercialPriority ?? 0);
      const rightPriority = Number(
        (right.metadata as { commercialPriority?: number } | null)?.commercialPriority ?? 0,
      );

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return left.name.localeCompare(right.name, 'es');
    });

    return {
      data: sortedBrands.map((brand) =>
        input.actor
          ? BrandEntity.fromState(brand).toAdminResponse()
          : BrandEntity.fromState(brand).toPublicResponse(),
      ),
    };
  }
}
