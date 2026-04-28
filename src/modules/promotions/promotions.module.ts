import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CreatePromotionUseCase } from 'src/modules/promotions/application/use-cases/create-promotion.use-case';
import { EvaluatePromotionsUseCase } from 'src/modules/promotions/application/use-cases/evaluate-promotions.use-case';
import { ListPromotionsUseCase } from 'src/modules/promotions/application/use-cases/list-promotions.use-case';
import { SetPromotionActiveUseCase } from 'src/modules/promotions/application/use-cases/set-promotion-active.use-case';
import { UpdatePromotionUseCase } from 'src/modules/promotions/application/use-cases/update-promotion.use-case';
import {
  PROMOTION_REPOSITORY,
} from 'src/modules/promotions/domain/repositories/promotion.repository';
import { PromotionEvaluatorService } from 'src/modules/promotions/domain/services/promotion-evaluator.service';
import { PromotionsController } from 'src/modules/promotions/infrastructure/http/controllers/promotions.controller';
import { PrismaPromotionRepository } from 'src/modules/promotions/infrastructure/repositories/prisma-promotion.repository';

@Module({
  imports: [AuthModule],
  controllers: [PromotionsController],
  providers: [
    PromotionEvaluatorService,
    EvaluatePromotionsUseCase,
    CreatePromotionUseCase,
    UpdatePromotionUseCase,
    SetPromotionActiveUseCase,
    ListPromotionsUseCase,
    PrismaPromotionRepository,
    {
      provide: PROMOTION_REPOSITORY,
      useExisting: PrismaPromotionRepository,
    },
  ],
  exports: [EvaluatePromotionsUseCase, PROMOTION_REPOSITORY],
})
export class PromotionsModule {}
