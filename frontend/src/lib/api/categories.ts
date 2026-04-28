import { createApiClient } from '@/lib/api/client';
import type {
  BackendCategoryRecord,
  BackendCollectionResponse,
} from '@/features/catalog/types';

const categoriesClient = createApiClient('/api/v1');

export async function listCategories() {
  const response = await categoriesClient.get<BackendCollectionResponse<BackendCategoryRecord>>(
    '/categories',
    {
      next: { revalidate: 120 },
    },
  );

  return response.data.data;
}

export async function getCategoryById(categoryId: string) {
  const response = await categoriesClient.get<BackendCategoryRecord>(`/categories/${categoryId}`, {
    next: { revalidate: 120 },
  });

  return response.data;
}

export async function getCategoryBySlug(categorySlug: string) {
  const categories = await listCategories();

  return categories.find((category) => category.slug === categorySlug) ?? null;
}
