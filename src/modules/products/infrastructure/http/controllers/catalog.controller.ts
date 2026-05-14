import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetCatalogOperationsUseCase } from 'src/modules/products/application/use-cases/get-catalog-operations.use-case';

@ApiTags('admin-catalog')
@ApiBearerAuth()
@Controller('admin/catalog')
export class CatalogController {
  constructor(
    @Inject(GetCatalogOperationsUseCase)
    private readonly getCatalogOperationsUseCase: GetCatalogOperationsUseCase,
  ) {}

  @Permissions('catalog.read')
  @Get('overview')
  overview(@CurrentUserDecorator() actor: CurrentUser, @Query('range') range?: string) {
    return this.getCatalogOperationsUseCase.execute(actor, { range });
  }

  @Permissions('catalog.read')
  @Get('metrics')
  async metrics(@CurrentUserDecorator() actor: CurrentUser, @Query('range') range?: string) {
    const data = await this.getCatalogOperationsUseCase.execute(actor, { range });
    return { generatedAt: data.generatedAt, range: data.range, metrics: data.metrics };
  }

  @Permissions('catalog.read')
  @Get('readiness')
  async readiness(@CurrentUserDecorator() actor: CurrentUser, @Query('range') range?: string) {
    const data = await this.getCatalogOperationsUseCase.execute(actor, { range });
    return { generatedAt: data.generatedAt, range: data.range, readiness: data.readiness };
  }
}

