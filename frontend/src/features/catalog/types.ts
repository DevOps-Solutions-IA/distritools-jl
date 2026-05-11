export interface BackendCollectionResponse<T> {
  data: T[];
}

export interface BackendProductRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: BackendProductMetadata | null;
  brand: BackendBrandRecord | null;
  category: BackendCategoryRecord | null;
}

export interface BackendCategoryRecord {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface BackendBrandRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: BackendBrandMetadata | null;
}

export interface BackendBrandMetadata {
  status: 'active' | 'inactive';
  commercialPriority: number;
  shortDescription: string;
  longDescription: string;
  industrialFocus: string[];
  productFamilies: string[];
  categorySlugs: string[];
  keywords: string[];
  logo: {
    assetPath: string | null;
    assetStatus: 'approved' | 'pending';
    notes: string;
  };
  sourceNotes: string[];
  rules: {
    allowProductAutoCreation: boolean;
    requiresManualSkuApproval: boolean;
    doNotClaimOfficialDistributor: boolean;
  };
}

export interface BackendProductMetadata {
  family?: string;
  subcategory?: string;
  longDescription?: string;
  presentation?: string;
  unit?: string;
  packageSize?: string;
  availability?: 'in-stock' | 'low-stock' | 'out-of-stock' | 'by-request';
  attributes?: Array<{ label: string; value: string }>;
  tags?: string[];
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string | null;
  };
  image?: {
    status?: 'approved' | 'pending';
    assetPath?: string | null;
    notes?: string;
  };
  source?: {
    type?: 'official' | 'internal' | 'distributor' | 'secondary';
    name?: string;
    url?: string;
    retrievedAt?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}

export interface BackendVariantRecord {
  id: string;
  productId: string | null;
  sku: string;
  name: string;
  price: string;
  taxRate: string;
  product: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    brand: BackendBrandRecord | null;
    category: BackendCategoryRecord | null;
  } | null;
}

export interface BackendSearchRecord {
  id: string;
  documentType: 'variant' | 'content';
  title: string;
  subtitle: string | null;
  sku: string | null;
  brandName: string | null;
  brandSlug?: string | null;
  categoryName: string | null;
  categorySlug?: string | null;
  placementKey: string | null;
  availability: number;
  priority: number;
}

export interface CatalogGap {
  key:
    | 'featured-products'
    | 'related-products'
    | 'product-images'
    | 'product-availability'
    | 'product-attributes'
    | 'product-by-slug';
  title: string;
  description: string;
}

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: BackendBrandMetadata | null;
}

export interface CatalogCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export type CatalogAvailabilityStatus =
  | 'in-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'check-backend'
  | 'not-implemented';

export interface CatalogAvailability {
  status: CatalogAvailabilityStatus;
  label: string;
  description: string;
  quantity?: number | null;
  source: 'search' | 'catalog-gap';
}

export interface CatalogVariant {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  price: number;
  priceLabel: string;
  taxRate: string;
  warehouseId?: string | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  presentation: string | null;
  brand: CatalogBrand | null;
  category: CatalogCategory | null;
  primaryVariantId: string | null;
  primarySku: string | null;
  primaryPrice: number | null;
  primaryPriceLabel: string | null;
  availability: CatalogAvailability;
  image: {
    status: 'approved' | 'pending';
    assetPath: string | null;
    notes: string | null;
  };
  attributes: Array<{ label: string; value: string }>;
  tags: string[];
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
  };
  source: {
    name: string | null;
    url: string | null;
    retrievedAt: string | null;
    confidence: 'high' | 'medium' | 'low' | null;
  };
}

export interface CatalogProductDetail extends CatalogProduct {
  variants: CatalogVariant[];
  featuredProductsGap: CatalogGap | null;
  relatedProductsGap: CatalogGap | null;
}

export interface CatalogSearchResult {
  id: string;
  documentType: 'variant' | 'content';
  title: string;
  subtitle: string | null;
  sku: string | null;
  brandName: string | null;
  categoryName: string | null;
  availability: CatalogAvailability;
  href: string;
}

export interface CatalogPageResult<T> {
  data: T;
  gaps: CatalogGap[];
}

export interface StorefrontHomeData {
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  featuredProducts: CatalogProduct[];
}

export interface BrandDirectoryData {
  brands: CatalogBrand[];
}

export interface BrandDetailData {
  brand: CatalogBrand;
  products: CatalogProduct[];
  relatedCategories: CatalogCategory[];
}

export interface ProductListingData {
  products: CatalogProduct[];
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  appliedFilters: {
    brandSlug?: string;
    categorySlug?: string;
    sort?: string;
  };
}

export interface CategoryListingData {
  category: CatalogCategory;
  products: CatalogProduct[];
  brands: CatalogBrand[];
}

export interface SearchPageData {
  query: string;
  results: CatalogSearchResult[];
  suggestions: string[];
}
