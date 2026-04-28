import { createApiClient } from '@/lib/api/client';
import type {
  BackendBrandRecord,
  BackendCollectionResponse,
} from '@/features/catalog/types';

const brandsClient = createApiClient('/api/v1');

export async function listBrands() {
  const response = await brandsClient.get<BackendCollectionResponse<BackendBrandRecord>>('/brands', {
    next: { revalidate: 120 },
  });

  return response.data.data;
}

export async function getBrandById(brandId: string) {
  const response = await brandsClient.get<BackendBrandRecord>(`/brands/${brandId}`, {
    next: { revalidate: 120 },
  });

  return response.data;
}

export async function getBrandBySlug(brandSlug: string) {
  const brands = await listBrands();
  return brands.find((brand) => brand.slug === brandSlug) ?? null;
}
