import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SearchRankingService } from 'src/modules/search/domain/services/search-ranking.service';

describe('SearchRankingService', async () => {
  const service = new SearchRankingService();

  await it('prioriza coincidencia exacta de SKU sobre texto parcial', () => {
    const results = service.sortResults('sku-001', [
      {
        id: 'a',
        documentType: 'variant',
        title: 'Industrial Drill',
        subtitle: null,
        sku: 'SKU-001',
        brandName: 'Brand',
        categoryName: 'Industrial',
        placementKey: null,
        availability: 1,
        priority: 10,
      },
      {
        id: 'b',
        documentType: 'variant',
        title: 'SKU-001 Compatible Accessory',
        subtitle: null,
        sku: 'SKU-999',
        brandName: 'Brand',
        categoryName: 'Industrial',
        placementKey: null,
        availability: 10,
        priority: 50,
      },
    ]);

    assert.equal(results[0].id, 'a');
  });
});
