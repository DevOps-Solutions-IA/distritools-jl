import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AutocompleteUseCase } from 'src/modules/search/application/use-cases/autocomplete.use-case';
import { ReindexContentUseCase } from 'src/modules/search/application/use-cases/reindex-content.use-case';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';
import { SearchCatalogUseCase } from 'src/modules/search/application/use-cases/search-catalog.use-case';
import {
  SEARCH_REPOSITORY,
} from 'src/modules/search/domain/repositories/search.repository';
import { SearchRankingService } from 'src/modules/search/domain/services/search-ranking.service';
import { SearchController } from 'src/modules/search/infrastructure/http/controllers/search.controller';
import { SearchEventSubscriber } from 'src/modules/search/infrastructure/jobs/search-event.subscriber';
import { PrismaSearchRepository } from 'src/modules/search/infrastructure/repositories/prisma-search.repository';

@Module({
  imports: [AuthModule],
  controllers: [SearchController],
  providers: [
    SearchRankingService,
    SearchCatalogUseCase,
    AutocompleteUseCase,
    ReindexVariantsUseCase,
    ReindexContentUseCase,
    SearchEventSubscriber,
    PrismaSearchRepository,
    {
      provide: SEARCH_REPOSITORY,
      useExisting: PrismaSearchRepository,
    },
  ],
})
export class SearchModule {}
