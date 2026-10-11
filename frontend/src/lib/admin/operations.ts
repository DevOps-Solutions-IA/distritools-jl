import { mapProduct } from '@/features/catalog/mappers';
import type {
  BackendBrandRecord,
  BackendCategoryRecord,
  BackendProductRecord,
  BackendVariantRecord,
} from '@/features/catalog/types';
import { adminFetch, AdminReadError } from '@/lib/admin/server-data';
import { adminContractFailure } from '@/lib/admin/transport/result';

export * from '@/lib/admin/transport/navigation';

export function getAdminCatalogSnapshot(
  mode: 'options',
): Promise<{
  brandRows: BackendBrandRecord[];
  categoryRows: BackendCategoryRecord[];
}>;
export function getAdminCatalogSnapshot(): ReturnType<
  typeof readCatalogSnapshot
>;
export async function getAdminCatalogSnapshot(mode?: 'options') {
  if (mode === 'options') {
    const [brandRows, categoryRows] = await Promise.all([
      collection<BackendBrandRecord>('/admin/brands'),
      collection<BackendCategoryRecord>('/admin/categories'),
    ]);
    return { brandRows, categoryRows };
  }
  return readCatalogSnapshot();
}

async function readCatalogSnapshot() {
  const [brands, categories, products, variants] = await Promise.all([
    collection<BackendBrandRecord>('/admin/brands'),
    collection<BackendCategoryRecord>('/admin/categories'),
    collection<BackendProductRecord>('/admin/products'),
    collection<BackendVariantRecord>('/admin/variants'),
  ]);

  const variantsByProductId = new Map<string, typeof variants>();
  for (const variant of variants) {
    if (!variant.productId) {
      continue;
    }
    const current = variantsByProductId.get(variant.productId) ?? [];
    current.push(variant);
    variantsByProductId.set(variant.productId, current);
  }

  const catalogProducts = products.map((product) =>
    mapProduct(product, variantsByProductId.get(product.id) ?? []),
  );

  return {
    available: true,
    brands: brands.length,
    categories: categories.length,
    products: products.length,
    variants: variants.length,
    brandRows: brands,
    categoryRows: categories,
    productRows: catalogProducts,
    variantRows: variants,
    productsWithoutPrice: catalogProducts.filter(
      (product) => product.primaryPrice === null,
    ).length,
    productsWithoutSku: catalogProducts.filter((product) => !product.primarySku)
      .length,
    productsWithoutImage: catalogProducts.filter(
      (product) => product.image.status !== 'approved',
    ).length,
    quoteOnlyProducts: catalogProducts.filter(
      (product) => product.primaryPrice === null,
    ).length,
  };
}

async function collection<T>(path: string): Promise<T[]> {
  const result = await adminFetch<{ data: T[] }>(path);
  if (!result.ok) throw new AdminReadError(result);
  if (!Array.isArray(result.data.data))
    throw new AdminReadError(adminContractFailure(result.status));
  return result.data.data;
}
