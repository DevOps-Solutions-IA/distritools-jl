import { Inject, Injectable } from '@nestjs/common';
import { SearchRankingService } from 'src/modules/search/domain/services/search-ranking.service';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';

@Injectable()
export class SearchCatalogUseCase {
  constructor(
    @Inject(SEARCH_REPOSITORY)
    private readonly searchRepository: SearchRepository,
    @Inject(SearchRankingService)
    private readonly searchRankingService: SearchRankingService,
  ) {}

  async execute(
    query: string,
    options?: { limit?: number; brandSlug?: string; categorySlug?: string },
  ) {
    const records = await this.searchRepository.search(query, options);

    return {
      data: this.searchRankingService.sortResults(query, records),
    };
  }
}
