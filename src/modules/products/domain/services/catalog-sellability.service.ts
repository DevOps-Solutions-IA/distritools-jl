import { Prisma } from '@prisma/client';

export type CatalogSellabilityStatus =
  | 'SELLABLE'
  | 'NOT_SELLABLE'
  | 'INCOMPLETE'
  | 'OUT_OF_STOCK'
  | 'MISSING_PRICE'
  | 'MISSING_SKU'
  | 'MISSING_CATEGORY'
  | 'MISSING_BRAND'
  | 'MISSING_DIMENSIONS'
  | 'ARCHIVED'
  | 'INACTIVE';

export interface CatalogSellabilityResult {
  sellable: boolean;
  status: CatalogSellabilityStatus;
  blockers: string[];
  warnings: string[];
  requiredActions: string[];
}

export interface CatalogVariantForSellability {
  id: string;
  sku: string | null;
  price: Prisma.Decimal | string | number | null;
  isActive: boolean;
  inventoryItems?: Array<{
    onHandQty: number;
    reservedQty: number;
    committedQty?: number | null;
  }>;
}

export interface CatalogProductForSellability {
  isActive: boolean;
  metadata: Prisma.JsonValue | null;
  brand: { id: string; isActive?: boolean | null } | null;
  category: { id: string; isActive?: boolean | null } | null;
  variants: CatalogVariantForSellability[];
}

export interface CheckoutVariantForSellability {
  id: string;
  productId?: string | null;
  sku?: string | null;
  price?: string | number | null;
  isActive: boolean;
  productIsActive?: boolean | null;
  brandId?: string | null;
  brandIsActive?: boolean | null;
  categoryId?: string | null;
  categoryIsActive?: boolean | null;
  productMetadata?: unknown | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function priceValue(value: CatalogVariantForSellability['price'] | CheckoutVariantForSellability['price']) {
  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

function hasApprovedImage(metadata: Prisma.JsonValue | null) {
  const image = asRecord(asRecord(metadata).image);
  return image.status === 'approved' && typeof image.assetPath === 'string' && image.assetPath.trim().length > 0;
}

function hasShippingDimensions(metadata: Prisma.JsonValue | null) {
  const shipping = asRecord(asRecord(metadata).shipping);
  const dimensions = asRecord(asRecord(metadata).dimensions);
  const source = Object.keys(shipping).length ? shipping : dimensions;
  const weight = Number(source.weightKg ?? source.weight ?? 0);
  const length = Number(source.lengthCm ?? source.length ?? 0);
  const width = Number(source.widthCm ?? source.width ?? 0);
  const height = Number(source.heightCm ?? source.height ?? 0);
  return weight > 0 && length > 0 && width > 0 && height > 0;
}

function isArchived(metadata: Prisma.JsonValue | null) {
  const record = asRecord(metadata);
  return record.catalogStatus === 'archived' || Boolean(record.archivedAt);
}

function availableStock(variant: CatalogVariantForSellability) {
  return (variant.inventoryItems ?? []).reduce(
    (total, item) => total + item.onHandQty - item.reservedQty - (item.committedQty ?? 0),
    0,
  );
}

function resultFrom(blockers: string[], warnings: string[]): CatalogSellabilityResult {
  const firstBlocker = blockers[0] ?? null;
  let status: CatalogSellabilityStatus = blockers.length ? 'NOT_SELLABLE' : warnings.length ? 'INCOMPLETE' : 'SELLABLE';

  if (firstBlocker === 'ARCHIVED') status = 'ARCHIVED';
  if (firstBlocker === 'INACTIVE') status = 'INACTIVE';
  if (firstBlocker === 'MISSING_CATEGORY') status = 'MISSING_CATEGORY';
  if (firstBlocker === 'MISSING_BRAND') status = 'MISSING_BRAND';
  if (firstBlocker === 'MISSING_SKU') status = 'MISSING_SKU';
  if (firstBlocker === 'MISSING_PRICE') status = 'MISSING_PRICE';
  if (firstBlocker === 'OUT_OF_STOCK') status = 'OUT_OF_STOCK';
  if (!blockers.length && warnings.includes('MISSING_DIMENSIONS')) status = 'MISSING_DIMENSIONS';

  return {
    sellable: blockers.length === 0,
    status,
    blockers,
    warnings,
    requiredActions: [...blockers, ...warnings].map((code) => {
      const actions: Record<string, string> = {
        ARCHIVED: 'Desarchivar producto antes de vender.',
        INACTIVE: 'Activar producto y variante.',
        MISSING_CATEGORY: 'Asignar categoría activa.',
        MISSING_BRAND: 'Asignar marca activa.',
        NO_ACTIVE_VARIANT: 'Crear o activar al menos una variante.',
        MISSING_SKU: 'Asignar SKU único a la variante.',
        MISSING_PRICE: 'Configurar precio mayor a cero.',
        OUT_OF_STOCK: 'Asignar stock disponible.',
        MISSING_DIMENSIONS: 'Completar peso y dimensiones para logística.',
        MISSING_MAIN_IMAGE: 'Cargar imagen principal aprobada.',
        MISSING_COST: 'Configurar costo para valorización/margen.',
      };
      return actions[code] ?? code;
    }),
  };
}

export function evaluateProductSellability(product: CatalogProductForSellability): CatalogSellabilityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const activeVariants = product.variants.filter((variant) => variant.isActive);

  if (isArchived(product.metadata)) blockers.push('ARCHIVED');
  if (!product.isActive) blockers.push('INACTIVE');
  if (!product.category || product.category.isActive === false) blockers.push('MISSING_CATEGORY');
  if (!product.brand || product.brand.isActive === false) blockers.push('MISSING_BRAND');
  if (!activeVariants.length) blockers.push('NO_ACTIVE_VARIANT');
  if (activeVariants.some((variant) => !variant.sku?.trim())) blockers.push('MISSING_SKU');
  if (activeVariants.some((variant) => !Number.isFinite(priceValue(variant.price)) || priceValue(variant.price) <= 0)) blockers.push('MISSING_PRICE');
  if (activeVariants.length && activeVariants.every((variant) => availableStock(variant) <= 0)) blockers.push('OUT_OF_STOCK');
  if (!hasShippingDimensions(product.metadata)) warnings.push('MISSING_DIMENSIONS');
  if (!hasApprovedImage(product.metadata)) warnings.push('MISSING_MAIN_IMAGE');

  return resultFrom([...new Set(blockers)], [...new Set(warnings)]);
}

export function evaluateCheckoutVariantSellability(variant: CheckoutVariantForSellability): string[] {
  const blockers: string[] = [];

  if (!variant.productId) blockers.push('NO_PRODUCT');
  if (!variant.isActive || variant.productIsActive === false || isArchived((variant.productMetadata ?? null) as Prisma.JsonValue | null)) blockers.push('INACTIVE');
  if (!variant.categoryId || variant.categoryIsActive === false) blockers.push('MISSING_CATEGORY');
  if (!variant.brandId || variant.brandIsActive === false) blockers.push('MISSING_BRAND');
  if (!variant.sku?.trim()) blockers.push('MISSING_SKU');
  if (!Number.isFinite(priceValue(variant.price)) || priceValue(variant.price) <= 0) blockers.push('MISSING_PRICE');

  return [...new Set(blockers)];
}
