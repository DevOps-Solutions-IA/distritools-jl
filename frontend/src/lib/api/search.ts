import { createApiClient } from '@/lib/api/client';
import type {
  BackendCollectionResponse,
  BackendSearchRecord,
} from '@/features/catalog/types';

const searchClient = createApiClient('/api/v1');

function buildSearchQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function searchCatalogApi(
  query: string,
  limit = 12,
  filters: { brandSlug?: string; categorySlug?: string } = {},
) {
  const response = await searchClient.get<BackendCollectionResponse<BackendSearchRecord>>(
    `/search${buildSearchQuery({
      q: query,
      limit,
      brandSlug: filters.brandSlug,
      categorySlug: filters.categorySlug,
    })}`,
    {
      cache: 'no-store',
    },
  );

  return response.data.data;
}

export async function autocompleteCatalogApi(query: string, limit = 6) {
  const response = await searchClient.get<BackendCollectionResponse<string>>(
    `/search/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      cache: 'no-store',
    },
  );

  return response.data.data;
}
