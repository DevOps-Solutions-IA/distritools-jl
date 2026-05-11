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
import { CreateProductUseCase } from 'src/modules/products/application/use-cases/create-product.use-case';
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
  @Permissions('products.manage')
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
  @Permissions('products.manage')
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
  @Permissions('products.manage')
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
  @Permissions('products.manage')
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
}
