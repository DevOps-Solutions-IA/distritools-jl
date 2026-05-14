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
import { CreateCategoryUseCase } from 'src/modules/categories/application/use-cases/create-category.use-case';
import { GetCategoryUseCase } from 'src/modules/categories/application/use-cases/get-category.use-case';
import { ListCategoriesUseCase } from 'src/modules/categories/application/use-cases/list-categories.use-case';
import { UpdateCategoryTreeUseCase } from 'src/modules/categories/application/use-cases/update-category-tree.use-case';
import { UpdateCategoryUseCase } from 'src/modules/categories/application/use-cases/update-category.use-case';
import { CreateCategoryRequestDto } from 'src/modules/categories/infrastructure/http/dto/create-category.request.dto';
import { UpdateCategoryTreeRequestDto } from 'src/modules/categories/infrastructure/http/dto/update-category-tree.request.dto';
import { UpdateCategoryRequestDto } from 'src/modules/categories/infrastructure/http/dto/update-category.request.dto';

@ApiTags('categories')
@Controller()
export class CategoriesController {
  constructor(
    @Inject(CreateCategoryUseCase)
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    @Inject(UpdateCategoryUseCase)
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    @Inject(UpdateCategoryTreeUseCase)
    private readonly updateCategoryTreeUseCase: UpdateCategoryTreeUseCase,
    @Inject(GetCategoryUseCase)
    private readonly getCategoryUseCase: GetCategoryUseCase,
    @Inject(ListCategoriesUseCase)
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
  ) {}

  @Public()
  @Get('categories')
  listPublic() {
    return this.listCategoriesUseCase.execute();
  }

  @Public()
  @Get('categories/:id')
  getPublic(@Param('id') categoryId: string) {
    return this.getCategoryUseCase.execute({ categoryId });
  }

  @ApiBearerAuth()
  @Permissions('categories.read')
  @Get('admin/categories')
  listAdmin(@CurrentUserDecorator() actor: CurrentUser) {
    return this.listCategoriesUseCase.execute({ actor });
  }

  @ApiBearerAuth()
  @Permissions('categories.read')
  @Get('admin/categories/:id')
  getAdmin(@Param('id') categoryId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getCategoryUseCase.execute({ actor, categoryId });
  }

  @ApiBearerAuth()
  @Permissions('categories.write')
  @Post('admin/categories')
  create(
    @Body() body: CreateCategoryRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createCategoryUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('categories.write')
  @Patch('admin/categories/:id')
  update(
    @Param('id') categoryId: string,
    @Body() body: UpdateCategoryRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateCategoryUseCase.execute({
      actor,
      categoryId,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('categories.write')
  @Patch('admin/categories/:id/tree')
  updateTree(
    @Param('id') categoryId: string,
    @Body() body: UpdateCategoryTreeRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateCategoryTreeUseCase.execute({
      actor,
      categoryId,
      ...body,
      ipAddress,
      userAgent,
    });
  }
}
