import { Inject, Injectable } from '@nestjs/common';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';

@Injectable()
export class AutocompleteUseCase {
  constructor(
    @Inject(SEARCH_REPOSITORY)
    private readonly searchRepository: SearchRepository,
  ) {}

  async execute(query: string, limit?: number) {
    return {
      data: await this.searchRepository.autocomplete(query, limit),
    };
  }
}
