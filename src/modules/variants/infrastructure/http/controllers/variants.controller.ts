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
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CreateVariantUseCase } from 'src/modules/variants/application/use-cases/create-variant.use-case';
import { GetVariantUseCase } from 'src/modules/variants/application/use-cases/get-variant.use-case';
import { ListVariantsUseCase } from 'src/modules/variants/application/use-cases/list-variants.use-case';
import { SetVariantStatusUseCase } from 'src/modules/variants/application/use-cases/set-variant-status.use-case';
import { UpdateVariantUseCase } from 'src/modules/variants/application/use-cases/update-variant.use-case';
import { CreateVariantRequestDto } from 'src/modules/variants/infrastructure/http/dto/create-variant.request.dto';
import { UpdateVariantRequestDto } from 'src/modules/variants/infrastructure/http/dto/update-variant.request.dto';

@ApiTags('variants')
@Controller()
export class VariantsController {
  constructor(
    @Inject(CreateVariantUseCase)
    private readonly createVariantUseCase: CreateVariantUseCase,
    @Inject(UpdateVariantUseCase)
    private readonly updateVariantUseCase: UpdateVariantUseCase,
    @Inject(SetVariantStatusUseCase)
    private readonly setVariantStatusUseCase: SetVariantStatusUseCase,
    @Inject(GetVariantUseCase)
    private readonly getVariantUseCase: GetVariantUseCase,
    @Inject(ListVariantsUseCase)
    private readonly listVariantsUseCase: ListVariantsUseCase,
  ) {}

  @Public()
  @Get('variants')
  listPublic(@Query('productId') productId?: string) {
    return this.listVariantsUseCase.execute({ productId });
  }

  @Public()
  @Get('variants/:id')
  getPublic(@Param('id') variantId: string) {
    return this.getVariantUseCase.execute({ variantId });
  }

  @ApiBearerAuth()
  @Permissions('variants.read')
  @Get('admin/variants')
  listAdmin(@CurrentUserDecorator() actor: CurrentUser, @Query('productId') productId?: string) {
    return this.listVariantsUseCase.execute({ actor, productId });
  }

  @ApiBearerAuth()
  @Permissions('variants.read')
  @Get('admin/variants/:id')
  getAdmin(@Param('id') variantId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getVariantUseCase.execute({ actor, variantId });
  }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Post('admin/variants')
  create(
    @Body() body: CreateVariantRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createVariantUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Patch('admin/variants/:id')
  update(
    @Param('id') variantId: string,
    @Body() body: UpdateVariantRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateVariantUseCase.execute({
      actor,
      variantId,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.publish')
  @Patch('admin/variants/:id/activate')
  activate(
    @Param('id') variantId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setVariantStatusUseCase.execute({
      actor,
      variantId,
      isActive: true,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('products.write')
  @Patch('admin/variants/:id/deactivate')
  deactivate(
    @Param('id') variantId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setVariantStatusUseCase.execute({
      actor,
      variantId,
      isActive: false,
      ipAddress,
      userAgent,
    });
  }
}
