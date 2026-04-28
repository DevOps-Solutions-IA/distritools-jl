import type {
  BackendBrandRecord,
  BackendCategoryRecord,
  BackendProductRecord,
  BackendSearchRecord,
  BackendVariantRecord,
  CatalogAvailability,
  CatalogBrand,
  CatalogCategory,
  CatalogGap,
  CatalogProduct,
  CatalogProductDetail,
  CatalogSearchResult,
  CatalogVariant,
} from '@/features/catalog/types';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function createCatalogGap(gap: CatalogGap): CatalogGap {
  return gap;
}

export function mapBrand(record: BackendBrandRecord): CatalogBrand {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    metadata: record.metadata,
  };
}

export function mapCategory(record: BackendCategoryRecord): CatalogCategory {
  return {
    id: record.id,
    parentId: record.parentId,
    name: record.name,
    slug: record.slug,
    description: record.description,
    sortOrder: record.sortOrder,
  };
}

export function createAvailabilityFromQuantity(quantity: number): CatalogAvailability {
  if (quantity <= 0) {
    return {
      status: 'out-of-stock',
      label: 'Sin disponibilidad',
      description: 'El índice de búsqueda reporta disponibilidad cero para esta coincidencia.',
      quantity,
      source: 'search',
    };
  }

  if (quantity <= 5) {
    return {
      status: 'low-stock',
      label: 'Stock bajo',
      description: 'La búsqueda reporta disponibilidad limitada; el backend confirmará la reserva al comprar.',
      quantity,
      source: 'search',
    };
  }

  return {
    status: 'in-stock',
    label: 'Disponible',
    description: 'La búsqueda reporta disponibilidad positiva; el backend confirma el stock real en checkout.',
    quantity,
    source: 'search',
  };
}

export function createBackendCheckAvailability(): CatalogAvailability {
  return {
    status: 'check-backend',
    label: 'Validación backend',
    description:
      'El backend público todavía no expone disponibilidad detallada por producto. El stock real se confirma al crear la orden.',
    source: 'catalog-gap',
  };
}

export function formatPrice(price: string | null | undefined): string | null {
  if (!price) {
    return null;
  }

  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice)) {
    return null;
  }

  return currencyFormatter.format(numericPrice);
}

export function mapVariant(record: BackendVariantRecord): CatalogVariant {
  return {
    id: record.id,
    productId: record.productId,
    name: record.name,
    sku: record.sku,
    price: Number(record.price),
    priceLabel: formatPrice(record.price) ?? record.price,
    taxRate: record.taxRate,
  };
}

export function mapProduct(
  record: BackendProductRecord,
  variants: BackendVariantRecord[] = [],
): CatalogProduct {
  const mappedVariants = variants.map(mapVariant);
  const primaryVariant = mappedVariants[0] ?? null;

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    brand: record.brand ? mapBrand(record.brand) : null,
    category: record.category ? mapCategory(record.category) : null,
    primaryVariantId: primaryVariant?.id ?? null,
    primarySku: primaryVariant?.sku ?? null,
    primaryPrice: primaryVariant?.price ?? null,
    primaryPriceLabel: primaryVariant?.priceLabel ?? null,
    availability: createBackendCheckAvailability(),
  };
}

export function mapProductDetail(
  record: BackendProductRecord,
  variants: BackendVariantRecord[] = [],
): CatalogProductDetail {
  const product = mapProduct(record, variants);

  return {
    ...product,
    variants: variants.map(mapVariant),
    featuredProductsGap: createCatalogGap({
      key: 'featured-products',
      title: 'Destacados curados no disponibles',
      description:
        'El backend público no expone todavía un endpoint dedicado de productos destacados. La home usa una muestra real del catálogo.',
    }),
    relatedProductsGap: createCatalogGap({
      key: 'related-products',
      title: 'Relacionados pendientes de contrato',
      description:
        'El backend no expone aún productos relacionados por producto. La sección queda explícita para integración futura.',
    }),
    technicalAttributes: [],
  };
}

export function mapSearchResult(
  record: BackendSearchRecord,
  href: string,
): CatalogSearchResult {
  return {
    id: record.id,
    documentType: record.documentType,
    title: record.title,
    subtitle: record.subtitle,
    sku: record.sku,
    brandName: record.brandName,
    categoryName: record.categoryName,
    availability: createAvailabilityFromQuantity(record.availability),
    href,
  };
}

export function sortCatalogProducts(products: CatalogProduct[], sort = 'featured') {
  const sortedProducts = [...products];

  if (sort === 'name-asc') {
    return sortedProducts.sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  if (sort === 'name-desc') {
    return sortedProducts.sort((left, right) => right.name.localeCompare(left.name, 'es'));
  }

  if (sort === 'price-asc') {
    return sortedProducts.sort(
      (left, right) => (left.primaryPrice ?? Number.MAX_SAFE_INTEGER) - (right.primaryPrice ?? Number.MAX_SAFE_INTEGER),
    );
  }

  if (sort === 'price-desc') {
    return sortedProducts.sort(
      (left, right) => (right.primaryPrice ?? 0) - (left.primaryPrice ?? 0),
    );
  }

  return sortedProducts.sort((left, right) => left.name.localeCompare(right.name, 'es'));
}
