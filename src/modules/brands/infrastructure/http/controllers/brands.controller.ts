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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CreateBrandUseCase } from 'src/modules/brands/application/use-cases/create-brand.use-case';
import { GetBrandUseCase } from 'src/modules/brands/application/use-cases/get-brand.use-case';
import { ListBrandsUseCase } from 'src/modules/brands/application/use-cases/list-brands.use-case';
import { SetBrandActiveUseCase } from 'src/modules/brands/application/use-cases/set-brand-active.use-case';
import { UpdateBrandUseCase } from 'src/modules/brands/application/use-cases/update-brand.use-case';
import { CreateBrandRequestDto } from 'src/modules/brands/infrastructure/http/dto/create-brand.request.dto';
import { UpdateBrandRequestDto } from 'src/modules/brands/infrastructure/http/dto/update-brand.request.dto';

@ApiTags('brands')
@Controller()
export class BrandsController {
  constructor(
    @Inject(CreateBrandUseCase)
    private readonly createBrandUseCase: CreateBrandUseCase,
    @Inject(UpdateBrandUseCase)
    private readonly updateBrandUseCase: UpdateBrandUseCase,
    @Inject(SetBrandActiveUseCase)
    private readonly setBrandActiveUseCase: SetBrandActiveUseCase,
    @Inject(GetBrandUseCase)
    private readonly getBrandUseCase: GetBrandUseCase,
    @Inject(ListBrandsUseCase)
    private readonly listBrandsUseCase: ListBrandsUseCase,
  ) {}

  @Public()
  @Get('brands')
  listPublic() {
    return this.listBrandsUseCase.execute();
  }

  @Public()
  @Get('brands/:id')
  getPublic(@Param('id') brandId: string) {
    return this.getBrandUseCase.execute({ brandId });
  }

  @ApiBearerAuth()
  @Permissions('brands.read')
  @Get('admin/brands')
  listAdmin(@CurrentUserDecorator() actor: CurrentUser) {
    return this.listBrandsUseCase.execute({ actor });
  }

  @ApiBearerAuth()
  @Permissions('brands.read')
  @Get('admin/brands/:id')
  getAdmin(@Param('id') brandId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getBrandUseCase.execute({ actor, brandId });
  }

  @ApiBearerAuth()
  @Permissions('brands.manage')
  @Post('admin/brands')
  create(
    @Body() body: CreateBrandRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createBrandUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('brands.manage')
  @Patch('admin/brands/:id')
  update(
    @Param('id') brandId: string,
    @Body() body: UpdateBrandRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateBrandUseCase.execute({
      actor,
      brandId,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('brands.manage')
  @Patch('admin/brands/:id/activate')
  activate(
    @Param('id') brandId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setBrandActiveUseCase.execute({
      actor,
      brandId,
      isActive: true,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('brands.manage')
  @Patch('admin/brands/:id/deactivate')
  deactivate(
    @Param('id') brandId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setBrandActiveUseCase.execute({
      actor,
      brandId,
      isActive: false,
      ipAddress,
      userAgent,
    });
  }
}
