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

type ProductMetadataAvailability = NonNullable<BackendProductRecord['metadata']>['availability'];

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
      description: 'Este producto no está disponible para compra inmediata.',
      quantity,
      source: 'search',
    };
  }

  if (quantity <= 5) {
    return {
      status: 'low-stock',
      label: 'Bajo stock',
      description: 'Quedan pocas unidades. Te recomendamos confirmar tu pedido pronto.',
      quantity,
      source: 'search',
    };
  }

  return {
    status: 'in-stock',
    label: 'Disponible',
    description: 'Producto disponible para agregar al carrito.',
    quantity,
    source: 'search',
  };
}

export function createBackendCheckAvailability(): CatalogAvailability {
  return {
    status: 'check-backend',
    label: 'Consultar',
    description:
      'Te ayudamos a confirmar existencia y tiempos de entrega antes de finalizar la compra.',
    source: 'catalog-gap',
  };
}

function createAvailabilityFromProductMetadata(
  availability: ProductMetadataAvailability,
): CatalogAvailability | null {
  if (availability === 'in-stock') {
    return {
      status: 'in-stock',
      label: 'Disponible',
      description: 'Producto disponible para agregar al carrito.',
      source: 'catalog-gap',
    };
  }

  if (availability === 'low-stock') {
    return {
      status: 'low-stock',
      label: 'Bajo stock',
      description: 'Quedan pocas unidades. Te recomendamos confirmar tu pedido pronto.',
      source: 'catalog-gap',
    };
  }

  if (availability === 'out-of-stock') {
    return {
      status: 'out-of-stock',
      label: 'Sin disponibilidad',
      description: 'Este producto no está disponible para compra inmediata.',
      source: 'catalog-gap',
    };
  }

  if (availability === 'by-request') {
    return {
      status: 'check-backend',
      label: 'Cotizar',
      description: 'Confirmamos precio y disponibilidad con nuestro equipo comercial.',
      source: 'catalog-gap',
    };
  }

  return null;
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

function normalizePresentationCopy(
  presentation: string | null | undefined,
): string | null {
  if (!presentation) {
    return null;
  }

  const normalized = presentation.toLocaleLowerCase('es-CO');
  const quoteTerms = [
    'referencia por asesor',
    'referencia por aplicación',
    'altura por asesor',
    'configuración por asesor',
    'equipo por asesor',
    'a consultar',
  ];

  if (quoteTerms.some((term) => normalized.includes(term))) {
    return null;
  }

  return presentation;
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
  const metadata = record.metadata;

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    longDescription: metadata?.longDescription ?? null,
    presentation: normalizePresentationCopy(
      metadata?.presentation ?? primaryVariant?.name ?? null,
    ),
    brand: record.brand ? mapBrand(record.brand) : null,
    category: record.category ? mapCategory(record.category) : null,
    primaryVariantId: primaryVariant?.id ?? null,
    primarySku: primaryVariant?.sku ?? null,
    primaryPrice: primaryVariant?.price ?? null,
    primaryPriceLabel: primaryVariant?.priceLabel ?? null,
    availability:
      createAvailabilityFromProductMetadata(metadata?.availability) ??
      createBackendCheckAvailability(),
    image: {
      status: metadata?.image?.status ?? 'pending',
      assetPath: metadata?.image?.assetPath ?? null,
      notes: metadata?.image?.notes ?? null,
    },
    attributes: metadata?.attributes ?? [],
    tags: metadata?.tags ?? [],
    seo: {
      title: metadata?.seo?.title ?? null,
      description: metadata?.seo?.description ?? null,
      keywords: metadata?.seo?.keywords ?? [],
      ogTitle: metadata?.seo?.ogTitle ?? null,
      ogDescription: metadata?.seo?.ogDescription ?? null,
      ogImage: metadata?.seo?.ogImage ?? null,
    },
    source: {
      name: metadata?.source?.name ?? null,
      url: metadata?.source?.url ?? null,
      retrievedAt: metadata?.source?.retrievedAt ?? null,
      confidence: metadata?.source?.confidence ?? null,
    },
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
      title: 'Destacados curados',
      description:
        'Selección comercial basada en el catálogo disponible.',
    }),
    relatedProductsGap: createCatalogGap({
      key: 'related-products',
      title: 'Productos relacionados',
      description: 'Productos complementarios para ampliar tu compra.',
    }),
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

  return sortedProducts.sort((left, right) => {
    const leftPurchasable = left.primaryPrice !== null ? 1 : 0;
    const rightPurchasable = right.primaryPrice !== null ? 1 : 0;

    if (leftPurchasable !== rightPurchasable) {
      return rightPurchasable - leftPurchasable;
    }

    return left.name.localeCompare(right.name, 'es');
  });
}
