import { getProductCommerceState } from '@/features/catalog/commerce';
import { isPubliclyPurchasable, normalizeSearchText } from '@/features/catalog/live-search';
import type { CatalogProduct } from '@/features/catalog/types';

export type CatalogCommerceFilter = 'all' | 'available' | 'low-stock';

export interface CatalogFilterInput {
  query?: string;
  categorySlug?: string;
  brandSlug?: string;
  status?: string;
  sort?: string;
}

function normalize(value: string | null | undefined) {
  return normalizeSearchText(value);
}

function matchesQuery(product: CatalogProduct, query?: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchable = [
    product.name,
    product.description,
    product.presentation,
    product.primarySku,
    product.brand?.name,
    product.category?.name,
    ...product.tags,
  ]
    .map(normalize)
    .join(' ');

  return searchable.includes(normalizedQuery);
}

function matchesCommerceState(product: CatalogProduct, status?: string) {
  const selectedStatus = (status ?? 'all') as CatalogCommerceFilter;
  const commerce = getProductCommerceState(product);

  if (selectedStatus === 'available') {
    return commerce.cartMode === 'buy';
  }

  if (selectedStatus === 'low-stock') {
    return product.availability.status === 'low-stock';
  }

  return true;
}

function sortProducts(products: CatalogProduct[], sort?: string) {
  const sorted = [...products];

  if (sort === 'name-asc') {
    return sorted.sort((left, right) => left.name.localeCompare(right.name, 'es-CO'));
  }

  if (sort === 'name-desc') {
    return sorted.sort((left, right) => right.name.localeCompare(left.name, 'es-CO'));
  }

  if (sort === 'price-asc') {
    return sorted.sort((left, right) => (left.primaryPrice ?? Number.MAX_SAFE_INTEGER) - (right.primaryPrice ?? Number.MAX_SAFE_INTEGER));
  }

  if (sort === 'price-desc') {
    return sorted.sort((left, right) => (right.primaryPrice ?? -1) - (left.primaryPrice ?? -1));
  }

  return sorted;
}

export function filterCatalogProducts(
  products: CatalogProduct[],
  filters: CatalogFilterInput,
) {
  return sortProducts(
    products.filter((product) => {
      const categoryMatch = filters.categorySlug
        ? product.category?.slug === filters.categorySlug
        : true;
      const brandMatch = filters.brandSlug ? product.brand?.slug === filters.brandSlug : true;

      return (
        isPubliclyPurchasable(product) &&
        categoryMatch &&
        brandMatch &&
        matchesQuery(product, filters.query) &&
        matchesCommerceState(product, filters.status)
      );
    }),
    filters.sort,
  );
}
