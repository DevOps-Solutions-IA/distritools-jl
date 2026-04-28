import { getCatalogGap } from '@/lib/api/catalog';

export async function getPublicAvailabilityStatus() {
  return {
    status: 'notImplemented' as const,
    gap: getCatalogGap('product-availability'),
  };
}
