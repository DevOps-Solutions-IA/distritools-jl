import { createApiClient } from '@/lib/api/client';
import type {
  BackendCollectionResponse,
  BackendProductRecord,
  BackendVariantRecord,
} from '@/features/catalog/types';

const productsClient = createApiClient('/api/v1');

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function listProducts(filters: { brandId?: string; categoryId?: string } = {}) {
  const response = await productsClient.get<BackendCollectionResponse<BackendProductRecord>>(
    `/products${buildQuery(filters)}`,
    {
      next: { revalidate: 60 },
    },
  );

  return response.data.data;
}

export async function getProductById(productId: string) {
  const response = await productsClient.get<BackendProductRecord>(`/products/${productId}`, {
    next: { revalidate: 60 },
  });

  return response.data;
}

export async function getProductBySlug(productSlug: string) {
  const products = await listProducts();

  return products.find((product) => product.slug === productSlug) ?? null;
}

export async function listVariants(filters: { productId?: string } = {}) {
  const response = await productsClient.get<BackendCollectionResponse<BackendVariantRecord>>(
    `/variants${buildQuery(filters)}`,
    {
      next: { revalidate: 60 },
    },
  );

  return response.data.data;
}

export async function getProductVariants(productId: string) {
  return listVariants({ productId });
}
