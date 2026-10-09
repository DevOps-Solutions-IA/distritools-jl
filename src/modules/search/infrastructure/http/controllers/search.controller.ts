import { BadRequestException, Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { v7 as uuidv7 } from 'uuid';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { parsePageSize } from 'src/common/utils/pagination.util';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
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
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
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
      limit: parsePageSize(limit),
      brandSlug,
      categorySlug,
    });
  }

  @Public()
  @Get('search/autocomplete')
  autocomplete(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.autocompleteUseCase.execute(query, parsePageSize(limit, 10));
  }

  @ApiBearerAuth()
  @Permissions('search.reindex')
  @Post('admin/search/reindex/variants')
  reindexVariants(
    @CurrentUserDecorator() actor: CurrentUser,
    @Body() body?: ReindexSearchRequestDto,
  ) {
    const ids = this.validateReindexIds(body);
    return this.auditedReindex(actor, 'variant', ids,
      () => this.reindexVariantsUseCase.execute(ids));
  }

  @ApiBearerAuth()
  @Permissions('search.reindex')
  @Post('admin/search/reindex/content')
  reindexContent(
    @CurrentUserDecorator() actor: CurrentUser,
    @Body() body?: ReindexSearchRequestDto,
  ) {
    const ids = this.validateReindexIds(body);
    return this.auditedReindex(actor, 'content', ids,
      () => this.reindexContentUseCase.execute(ids));
  }

  private validateReindexIds(body?: ReindexSearchRequestDto): string[] | undefined {
    // Explicit runtime validation also protects the route when decorator type metadata
    // is unavailable (for example in the isolated test runner).
    if (body === undefined) return undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== 'ids')) {
      throw new BadRequestException('Invalid search reindex request');
    }
    if (body.ids === undefined) return undefined;
    if (!Array.isArray(body.ids) || body.ids.length > 1000 ||
      body.ids.some((id) => typeof id !== 'string' || !isUUID(id))) {
      throw new BadRequestException('Reindex ids must be an array of at most 1000 UUIDs');
    }
    return body.ids;
  }

  private async auditedReindex(
    actor: CurrentUser,
    documentType: 'variant' | 'content',
    ids: string[] | undefined,
    effect: () => Promise<{ reindexed: number }>,
  ) {
    assertHasPermissions(actor?.permissions ?? [], ['search.reindex']);
    const entityId = uuidv7();
    const scope = { projectionKind: documentType, fullCatalog: !ids?.length, requestedCount: ids?.length ?? 0 };
    const audit = (action: string, afterData: unknown) => this.auditRepository.write({
      actorUserId: actor.sub, action, entityType: 'search_projection', entityId, afterData,
    });
    // Fail before projection work if the operation cannot be recorded.
    await audit('search.reindex_requested', scope);
    let result: { reindexed: number };
    try {
      result = await effect();
    } catch (error) {
      await audit('search.reindex_failed', scope);
      throw error;
    }
    // Batches already committed are replayable if this completion audit fails.
    await audit('search.reindex_completed', { ...scope, reindexed: result.reindexed });
    return result;
  }
}
