import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  PROMOTION_REPOSITORY,
  PromotionRepository,
} from 'src/modules/promotions/domain/repositories/promotion.repository';
import { PromotionEntity } from 'src/modules/promotions/domain/entities/promotion.entity';

@Injectable()
export class ListPromotionsUseCase {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
  ) {}

  async execute(actor: CurrentUser) {
    assertHasPermissions(actor.permissions, ['promotions.manage']);

    const promotions = await this.promotionRepository.list();

    return {
      data: promotions.map((promotion) => PromotionEntity.fromState(promotion).toResponse()),
    };
  }
}
