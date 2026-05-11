import { getCatalogGap } from '@/lib/api/catalog';
import { getBrandBySlug, listBrands } from '@/lib/api/brands';
import { getCategoryBySlug, listCategories } from '@/lib/api/categories';
import { getPublicAvailabilityStatus } from '@/lib/api/availability';
import {
  getProductBySlug,
  getProductVariants,
  listVariants,
  listProducts,
} from '@/lib/api/products';
import { autocompleteCatalogApi, searchCatalogApi } from '@/lib/api/search';
import {
  mapBrand,
  mapCategory,
  mapProduct,
  mapProductDetail,
  mapSearchResult,
  sortCatalogProducts,
} from '@/features/catalog/mappers';
import type {
  BackendProductRecord,
  BrandDetailData,
  BrandDirectoryData,
  CatalogGap,
  CatalogPageResult,
  CategoryListingData,
  ProductListingData,
  SearchPageData,
  StorefrontHomeData,
} from '@/features/catalog/types';

function collectGaps(keys: CatalogGap['key'][]): CatalogGap[] {
  return keys
    .map((key) => getCatalogGap(key))
    .filter((gap): gap is CatalogGap => gap !== null);
}

export async function getStorefrontHomeData(): Promise<CatalogPageResult<StorefrontHomeData>> {
  const [categories, brands, products, variants] = await Promise.all([
    listCategories(),
    listBrands(),
    listProducts(),
    listVariants(),
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

  const featuredSample = sortCatalogProducts(
    products.map((product) => mapProduct(product, variantsByProductId.get(product.id) ?? [])),
    'featured',
  ).slice(0, 6);

  return {
    data: {
      categories: categories.slice(0, 6).map(mapCategory),
      brands: brands.slice(0, 8).map(mapBrand),
      featuredProducts: featuredSample,
    },
    gaps: collectGaps(['featured-products', 'product-availability', 'product-images']),
  };
}

export async function getBrandDirectoryData(): Promise<CatalogPageResult<BrandDirectoryData>> {
  const brands = await listBrands();

  return {
    data: {
      brands: brands.map(mapBrand),
    },
    gaps: [],
  };
}

export async function getBrandDetailData(
  brandSlug: string,
): Promise<CatalogPageResult<BrandDetailData> | null> {
  const [brand, categories, variants] = await Promise.all([
    getBrandBySlug(brandSlug),
    listCategories(),
    listVariants(),
  ]);

  if (!brand) {
    return null;
  }

  const products = await listProducts({ brandId: brand.id });
  const variantsByProductId = new Map<string, typeof variants>();
  for (const variant of variants) {
    if (!variant.productId) {
      continue;
    }

    const current = variantsByProductId.get(variant.productId) ?? [];
    current.push(variant);
    variantsByProductId.set(variant.productId, current);
  }

  const relatedCategories = categories
    .filter((category) => brand.metadata?.categorySlugs?.includes(category.slug))
    .map(mapCategory);

  return {
    data: {
      brand: mapBrand(brand),
      products: products.map((product) => mapProduct(product, variantsByProductId.get(product.id) ?? [])),
      relatedCategories,
    },
    gaps: collectGaps(['product-availability', 'product-images']),
  };
}

export async function getProductListingData(input: {
  brandSlug?: string;
  categorySlug?: string;
  sort?: string;
}): Promise<CatalogPageResult<ProductListingData>> {
  const [brands, categories, variants] = await Promise.all([
    listBrands(),
    listCategories(),
    listVariants(),
  ]);
  const selectedBrand = brands.find((brand) => brand.slug === input.brandSlug);
  const selectedCategory = categories.find((category) => category.slug === input.categorySlug);

  const products = await listProducts({
    brandId: selectedBrand?.id,
    categoryId: selectedCategory?.id,
  });

  const variantsByProductId = new Map<string, typeof variants>();
  for (const variant of variants) {
    if (!variant.productId) {
      continue;
    }

    const current = variantsByProductId.get(variant.productId) ?? [];
    current.push(variant);
    variantsByProductId.set(variant.productId, current);
  }

  return {
    data: {
      products: sortCatalogProducts(
        products.map((product) => mapProduct(product, variantsByProductId.get(product.id) ?? [])),
        input.sort,
      ),
      brands: brands.map(mapBrand),
      categories: categories.map(mapCategory),
      appliedFilters: input,
    },
    gaps: collectGaps(['product-availability', 'product-images']),
  };
}

export async function getProductDetailData(productSlug: string) {
  const product = await getProductBySlug(productSlug);
  if (!product) {
    return {
      data: null,
      gaps: collectGaps(['product-by-slug']),
    } satisfies CatalogPageResult<null>;
  }

  const variants = await getProductVariants(product.id);
  const availability = await getPublicAvailabilityStatus();
  const productDetail = mapProductDetail(product, variants);

  return {
    data: {
      ...productDetail,
      availability:
        availability.status === 'notImplemented'
          ? productDetail.availability
          : productDetail.availability,
    },
    gaps: collectGaps([
      'product-by-slug',
      'product-availability',
      'product-images',
      'product-attributes',
      'related-products',
    ]),
  } satisfies CatalogPageResult<ReturnType<typeof mapProductDetail>>;
}

export async function getCategoryListingData(categorySlug: string): Promise<CatalogPageResult<CategoryListingData> | null> {
  const [category, brands, variants] = await Promise.all([
    getCategoryBySlug(categorySlug),
    listBrands(),
    listVariants(),
  ]);
  if (!category) {
    return null;
  }

  const products = await listProducts({ categoryId: category.id });
  const variantsByProductId = new Map<string, typeof variants>();
  for (const variant of variants) {
    if (!variant.productId) {
      continue;
    }

    const current = variantsByProductId.get(variant.productId) ?? [];
    current.push(variant);
    variantsByProductId.set(variant.productId, current);
  }

  return {
    data: {
      category: mapCategory(category),
      products: products.map((product) => mapProduct(product, variantsByProductId.get(product.id) ?? [])),
      brands: brands.map(mapBrand),
    },
    gaps: collectGaps(['product-availability', 'product-images']),
  };
}

function resolveSearchHref(record: { documentType: 'variant' | 'content'; title: string }, products: BackendProductRecord[]) {
  if (record.documentType === 'content') {
    return '/';
  }

  const matchedProduct = products.find(
    (product) =>
      product.name.localeCompare(record.title, 'es', { sensitivity: 'base' }) === 0 ||
      product.slug.localeCompare(record.title, 'es', { sensitivity: 'base' }) === 0,
  );

  return matchedProduct ? `/productos/${matchedProduct.slug}` : `/productos`;
}

export async function getSearchPageData(query: string): Promise<CatalogPageResult<SearchPageData>> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      data: {
        query: '',
        results: [],
        suggestions: [],
      },
      gaps: [],
    };
  }

  const [results, suggestions, products] = await Promise.all([
    searchCatalogApi(normalizedQuery),
    autocompleteCatalogApi(normalizedQuery),
    listProducts(),
  ]);

  return {
    data: {
      query: normalizedQuery,
      results: results.map((result) =>
        mapSearchResult(result, resolveSearchHref(result, products)),
      ),
      suggestions,
    },
    gaps: collectGaps(['product-by-slug']),
  };
}
