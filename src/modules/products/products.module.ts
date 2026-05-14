import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProductsController } from 'src/modules/products/infrastructure/http/controllers/products.controller';
import { CatalogController } from 'src/modules/products/infrastructure/http/controllers/catalog.controller';
import { ArchiveProductUseCase } from 'src/modules/products/application/use-cases/archive-product.use-case';
import { CreateProductUseCase } from 'src/modules/products/application/use-cases/create-product.use-case';
import { EvaluateProductSellabilityUseCase } from 'src/modules/products/application/use-cases/evaluate-product-sellability.use-case';
import { GetCatalogOperationsUseCase } from 'src/modules/products/application/use-cases/get-catalog-operations.use-case';
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
  controllers: [ProductsController, CatalogController],
  providers: [
    ProductPolicyService,
    ArchiveProductUseCase,
    CreateProductUseCase,
    EvaluateProductSellabilityUseCase,
    GetCatalogOperationsUseCase,
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
  exports: [PRODUCT_REPOSITORY, GetProductUseCase, ListProductsUseCase, EvaluateProductSellabilityUseCase],
})
export class ProductsModule {}
