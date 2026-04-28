import { Inject, Injectable } from '@nestjs/common';
import {
  PROMOTION_REPOSITORY,
  PromotionRepository,
} from 'src/modules/promotions/domain/repositories/promotion.repository';
import {
  PromotionEvaluationLine,
  PromotionEvaluatorService,
} from 'src/modules/promotions/domain/services/promotion-evaluator.service';
import { PromotionEntity } from 'src/modules/promotions/domain/entities/promotion.entity';

@Injectable()
export class EvaluatePromotionsUseCase {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(PromotionEvaluatorService)
    private readonly promotionEvaluatorService: PromotionEvaluatorService,
  ) {}

  async execute(lines: PromotionEvaluationLine[]) {
    const promotions = await this.promotionRepository.listActive(new Date());

    return this.promotionEvaluatorService.evaluate(
      promotions.map((promotion) => PromotionEntity.fromState(promotion)),
      lines,
    );
  }
}
