import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { AutocompleteUseCase } from 'src/modules/search/application/use-cases/autocomplete.use-case';
import { ReindexContentUseCase } from 'src/modules/search/application/use-cases/reindex-content.use-case';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';
import { SearchCatalogUseCase } from 'src/modules/search/application/use-cases/search-catalog.use-case';
import { ReindexSearchRequestDto } from 'src/modules/search/infrastructure/http/dto/reindex-search.request.dto';

@ApiTags('search')
@Controller()
export class SearchController {
  constructor(
    @Inject(SearchCatalogUseCase)
    private readonly searchCatalogUseCase: SearchCatalogUseCase,
    @Inject(AutocompleteUseCase)
    private readonly autocompleteUseCase: AutocompleteUseCase,
    @Inject(ReindexVariantsUseCase)
    private readonly reindexVariantsUseCase: ReindexVariantsUseCase,
    @Inject(ReindexContentUseCase)
    private readonly reindexContentUseCase: ReindexContentUseCase,
  ) {}

  @Public()
  @Get('search')
  search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('brandSlug') brandSlug?: string,
    @Query('categorySlug') categorySlug?: string,
  ) {
    return this.searchCatalogUseCase.execute(query, {
      limit: limit ? Number(limit) : undefined,
      brandSlug,
      categorySlug,
    });
  }

  @Public()
  @Get('search/autocomplete')
  autocomplete(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.autocompleteUseCase.execute(query, limit ? Number(limit) : undefined);
  }

  @ApiBearerAuth()
  @Permissions('search.reindex')
  @Post('admin/search/reindex/variants')
  reindexVariants(
    @CurrentUserDecorator() actor: CurrentUser,
    @Body() body?: ReindexSearchRequestDto,
  ) {
    return this.reindexVariantsUseCase.execute(body?.ids);
  }

  @ApiBearerAuth()
  @Permissions('search.reindex')
  @Post('admin/search/reindex/content')
  reindexContent(
    @CurrentUserDecorator() actor: CurrentUser,
    @Body() body?: ReindexSearchRequestDto,
  ) {
    return this.reindexContentUseCase.execute(body?.ids);
  }
}
