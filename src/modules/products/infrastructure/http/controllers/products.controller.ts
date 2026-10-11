import { ApproveProductImageUseCase } from 'src/modules/products/application/use-cases/approve-product-image.use-case';
import { ProductImageApprovalService } from 'src/modules/products/domain/services/product-image-approval.service';
import { ApproveProductImageRequestDto } from 'src/modules/products/infrastructure/http/dto/approve-product-image.request.dto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { ArchiveProductUseCase } from 'src/modules/products/application/use-cases/archive-product.use-case';
import { CreateProductUseCase } from 'src/modules/products/application/use-cases/create-product.use-case';
import { EvaluateProductSellabilityUseCase } from 'src/modules/products/application/use-cases/evaluate-product-sellability.use-case';
import { GetProductUseCase } from 'src/modules/products/application/use-cases/get-product.use-case';
import { ListProductsUseCase } from 'src/modules/products/application/use-cases/list-products.use-case';
import { SetProductStatusUseCase } from 'src/modules/products/application/use-cases/set-product-status.use-case';
import { UpdateProductUseCase } from 'src/modules/products/application/use-cases/update-product.use-case';
import { CreateProductRequestDto } from 'src/modules/products/infrastructure/http/dto/create-product.request.dto';
import { UpdateProductRequestDto } from 'src/modules/products/infrastructure/http/dto/update-product.request.dto';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(
    @Inject(ProductImageApprovalService) private readonly media: ProductImageApprovalService,
    @Inject(ApproveProductImageUseCase) private readonly approveImage: ApproveProductImageUseCase,
    @Inject(CreateProductUseCase)
    private readonly createProductUseCase: CreateProductUseCase,
    @Inject(UpdateProductUseCase)
    private readonly updateProductUseCase: UpdateProductUseCase,
    @Inject(SetProductStatusUseCase)
    private readonly setProductStatusUseCase: SetProductStatusUseCase,
    @Inject(GetProductUseCase)
    private readonly getProductUseCase: GetProductUseCase,
    @Inject(ListProductsUseCase)
    private readonly listProductsUseCase: ListProductsUseCase,
    @Inject(EvaluateProductSellabilityUseCase)
    private readonly evaluateProductSellabilityUseCase: EvaluateProductSellabilityUseCase,
    @Inject(ArchiveProductUseCase)
    private readonly archiveProductUseCase: ArchiveProductUseCase,
  ) {}

  @Public()
  @Get('products')
  listPublic(
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.listProductsUseCase.execute({ brandId, categoryId });
  }

  @Public()
  @Get('products/:id')
  getPublic(@Param('id') productId: string) {
    return this.getProductUseCase.execute({ productId });
  }

  @ApiBearerAuth()
  @Permissions('products.read')
  @Get('admin/media-resources')
  listMediaResources() { return { data: this.media.list() }; }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Post('admin/products/:id/image-approval')
  approveProductImage(
    @Param('id') productId: string,
    @Body() body: ApproveProductImageRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) { return this.approveImage.execute({ actor, productId, ...body, ipAddress, userAgent }); }

  @ApiBearerAuth()
  @Permissions('products.read')
  @Get('admin/products')
  listAdmin(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.listProductsUseCase.execute({ actor, brandId, categoryId });
  }

  @ApiBearerAuth()
  @Permissions('products.read')
  @Get('admin/products/:id')
  getAdmin(@Param('id') productId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getProductUseCase.execute({ actor, productId });
  }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Post('admin/products')
  create(
    @Body() body: CreateProductRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const metadata =
      body.metadata === undefined
        ? undefined
        : (body.metadata as Prisma.InputJsonValue);

    return this.createProductUseCase.execute({
      actor,
      ...body,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Patch('admin/products/:id')
  update(
    @Param('id') productId: string,
    @Body() body: UpdateProductRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const metadata =
      body.metadata === undefined || body.metadata === null
        ? body.metadata
        : (body.metadata as Prisma.InputJsonValue);

    return this.updateProductUseCase.execute({
      actor,
      productId,
      ...body,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.publish')
  @Patch('admin/products/:id/activate')
  activate(
    @Param('id') productId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setProductStatusUseCase.execute({
      actor,
      productId,
      isActive: true,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Patch('admin/products/:id/deactivate')
  deactivate(
    @Param('id') productId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setProductStatusUseCase.execute({
      actor,
      productId,
      isActive: false,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.archive')
  @Post('admin/products/:id/archive')
  archive(
    @Param('id') productId: string,
    @Body('reason') reason: string | undefined,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.archiveProductUseCase.execute({
      actor,
      productId,
      reason,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.read')
  @Post('admin/products/:id/validate-sellability')
  validateSellability(
    @Param('id') productId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.evaluateProductSellabilityUseCase.execute({
      actor,
      productId,
      audit: true,
      ipAddress,
      userAgent,
    });
  }
}
