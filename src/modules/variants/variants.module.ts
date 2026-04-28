import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { VariantsController } from 'src/modules/variants/infrastructure/http/controllers/variants.controller';
import { CreateVariantUseCase } from 'src/modules/variants/application/use-cases/create-variant.use-case';
import { UpdateVariantUseCase } from 'src/modules/variants/application/use-cases/update-variant.use-case';
import { SetVariantStatusUseCase } from 'src/modules/variants/application/use-cases/set-variant-status.use-case';
import { GetVariantUseCase } from 'src/modules/variants/application/use-cases/get-variant.use-case';
import { ListVariantsUseCase } from 'src/modules/variants/application/use-cases/list-variants.use-case';
import { VariantPolicyService } from 'src/modules/variants/domain/services/variant-policy.service';
import {
  VARIANT_REPOSITORY,
} from 'src/modules/variants/domain/repositories/variant.repository';
import { PrismaVariantRepository } from 'src/modules/variants/infrastructure/repositories/prisma-variant.repository';

@Module({
  imports: [AuthModule],
  controllers: [VariantsController],
  providers: [
    VariantPolicyService,
    CreateVariantUseCase,
    UpdateVariantUseCase,
    SetVariantStatusUseCase,
    GetVariantUseCase,
    ListVariantsUseCase,
    PrismaVariantRepository,
    {
      provide: VARIANT_REPOSITORY,
      useExisting: PrismaVariantRepository,
    },
  ],
  exports: [VARIANT_REPOSITORY, GetVariantUseCase, ListVariantsUseCase],
})
export class VariantsModule {}
