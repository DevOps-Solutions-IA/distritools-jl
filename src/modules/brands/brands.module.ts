import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { BrandsController } from 'src/modules/brands/infrastructure/http/controllers/brands.controller';
import { CreateBrandUseCase } from 'src/modules/brands/application/use-cases/create-brand.use-case';
import { UpdateBrandUseCase } from 'src/modules/brands/application/use-cases/update-brand.use-case';
import { SetBrandActiveUseCase } from 'src/modules/brands/application/use-cases/set-brand-active.use-case';
import { GetBrandUseCase } from 'src/modules/brands/application/use-cases/get-brand.use-case';
import { ListBrandsUseCase } from 'src/modules/brands/application/use-cases/list-brands.use-case';
import { BrandPolicyService } from 'src/modules/brands/domain/services/brand-policy.service';
import {
  BRAND_REPOSITORY,
} from 'src/modules/brands/domain/repositories/brand.repository';
import { PrismaBrandRepository } from 'src/modules/brands/infrastructure/repositories/prisma-brand.repository';

@Module({
  imports: [AuthModule],
  controllers: [BrandsController],
  providers: [
    BrandPolicyService,
    CreateBrandUseCase,
    UpdateBrandUseCase,
    SetBrandActiveUseCase,
    GetBrandUseCase,
    ListBrandsUseCase,
    PrismaBrandRepository,
    {
      provide: BRAND_REPOSITORY,
      useExisting: PrismaBrandRepository,
    },
  ],
  exports: [BRAND_REPOSITORY, GetBrandUseCase, ListBrandsUseCase],
})
export class BrandsModule {}
