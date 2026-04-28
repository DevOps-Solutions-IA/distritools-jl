import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProductsController } from 'src/modules/products/infrastructure/http/controllers/products.controller';
import { CreateProductUseCase } from 'src/modules/products/application/use-cases/create-product.use-case';
import { UpdateProductUseCase } from 'src/modules/products/application/use-cases/update-product.use-case';
import { SetProductStatusUseCase } from 'src/modules/products/application/use-cases/set-product-status.use-case';
import { GetProductUseCase } from 'src/modules/products/application/use-cases/get-product.use-case';
import { ListProductsUseCase } from 'src/modules/products/application/use-cases/list-products.use-case';
import { ProductPolicyService } from 'src/modules/products/domain/services/product-policy.service';
import {
  PRODUCT_REPOSITORY,
} from 'src/modules/products/domain/repositories/product.repository';
import { PrismaProductRepository } from 'src/modules/products/infrastructure/repositories/prisma-product.repository';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductPolicyService,
    CreateProductUseCase,
    UpdateProductUseCase,
    SetProductStatusUseCase,
    GetProductUseCase,
    ListProductsUseCase,
    PrismaProductRepository,
    {
      provide: PRODUCT_REPOSITORY,
      useExisting: PrismaProductRepository,
    },
  ],
  exports: [PRODUCT_REPOSITORY, GetProductUseCase, ListProductsUseCase],
})
export class ProductsModule {}
