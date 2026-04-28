import { createApiClient } from '@/lib/api/client';
import type { BackendCollectionResponse, BackendBrandRecord } from '@/features/catalog/types';

const adminBrandsClient = createApiClient('/api/v1');

export async function listAdminBrands(token: string) {
  const response = await adminBrandsClient.get<BackendCollectionResponse<BackendBrandRecord>>(
    '/admin/brands',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    },
  );

  return response.data.data;
}
