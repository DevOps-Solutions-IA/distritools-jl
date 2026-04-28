import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { BrandEntity } from 'src/modules/brands/domain/entities/brand.entity';
import {
  BRAND_REPOSITORY,
  BrandRepository,
} from 'src/modules/brands/domain/repositories/brand.repository';
import { BrandPolicyService } from 'src/modules/brands/domain/services/brand-policy.service';

export interface GetBrandInput {
  brandId: string;
  actor?: CurrentUser | null;
}

@Injectable()
export class GetBrandUseCase {
  constructor(
    @Inject(BRAND_REPOSITORY)
    private readonly brandRepository: BrandRepository,
    @Inject(BrandPolicyService)
    private readonly brandPolicyService: BrandPolicyService,
  ) {}

  async execute(input: GetBrandInput) {
    const brand = this.brandPolicyService.ensureExists(
      await this.brandRepository.findById(input.brandId),
    );

    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['brands.read']);
      return BrandEntity.fromState(brand).toAdminResponse();
    }

    if (!brand.isActive) {
      throw new NotFoundException('Brand not found');
    }

    return BrandEntity.fromState(brand).toPublicResponse();
  }
}
