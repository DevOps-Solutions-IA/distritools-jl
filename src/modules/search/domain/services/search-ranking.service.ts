import { Injectable } from '@nestjs/common';
import { SearchResultRecord } from 'src/modules/search/domain/repositories/search.repository';

@Injectable()
export class SearchRankingService {
  sortResults(query: string, results: SearchResultRecord[]): SearchResultRecord[] {
    const normalizedQuery = query.trim().toLowerCase();

    return [...results].sort((left, right) => {
      const leftScore = this.score(normalizedQuery, left);
      const rightScore = this.score(normalizedQuery, right);

      return (
        rightScore - leftScore ||
        right.availability - left.availability ||
        right.priority - left.priority ||
        left.title.localeCompare(right.title)
      );
    });
  }

  private score(query: string, result: SearchResultRecord): number {
    let score = 0;
    const title = result.title.toLowerCase();
    const sku = result.sku?.toLowerCase() ?? '';
    const brand = result.brandName?.toLowerCase() ?? '';
    const category = result.categoryName?.toLowerCase() ?? '';

    if (sku === query) score += 200;
    if (title === query) score += 150;
    if (title.startsWith(query)) score += 120;
    if (sku.startsWith(query)) score += 110;
    if (brand.includes(query)) score += 60;
    if (category.includes(query)) score += 50;
    if (title.includes(query)) score += 100;
    if (result.availability > 0) score += 20;

    return score;
  }
}
