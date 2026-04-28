import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { VariantEntity } from 'src/modules/variants/domain/entities/variant.entity';
import {
  VARIANT_REPOSITORY,
  VariantRepository,
} from 'src/modules/variants/domain/repositories/variant.repository';
import { VariantPolicyService } from 'src/modules/variants/domain/services/variant-policy.service';

export interface GetVariantInput {
  variantId: string;
  actor?: CurrentUser | null;
}

@Injectable()
export class GetVariantUseCase {
  constructor(
    @Inject(VARIANT_REPOSITORY)
    private readonly variantRepository: VariantRepository,
    @Inject(VariantPolicyService)
    private readonly variantPolicyService: VariantPolicyService,
  ) {}

  async execute(input: GetVariantInput) {
    const variant = this.variantPolicyService.ensureExists(
      await this.variantRepository.findById(input.variantId),
    );

    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['variants.read']);
      return VariantEntity.fromState(variant).toAdminResponse();
    }

    if (!variant.isActive || (variant.product && !variant.product.isActive)) {
      throw new NotFoundException('Variant not found');
    }

    return VariantEntity.fromState(variant).toPublicResponse();
  }
}
