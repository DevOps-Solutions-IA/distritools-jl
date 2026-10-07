import { Prisma } from '@prisma/client';

export interface SearchResultRecord {
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

export interface VariantIndexSource {
  id: string;
  sku: string;
  name: string;
  productName: string | null;
  brandName: string | null;
  brandSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  description: string | null;
  metadataText?: string | null;
  isActive: boolean;
  availability: number;
}

export interface ContentIndexSource {
  id: string;
  title: string;
  placementKey: string;
  isPublished: boolean;
  priority: number;
  bodyText: string;
}

export interface SearchRepository {
  search(
    query: string,
    options?: { limit?: number; brandSlug?: string; categorySlug?: string },
  ): Promise<SearchResultRecord[]>;
  autocomplete(query: string, limit?: number): Promise<string[]>;
  lockVariantProjection(tx: Prisma.TransactionClient, variantId: string): Promise<void>;
  lockContentProjection(tx: Prisma.TransactionClient, contentId: string): Promise<void>;
  upsertVariantDocuments(documents: VariantIndexSource[], tx?: Prisma.TransactionClient): Promise<void>;
  upsertContentDocuments(documents: ContentIndexSource[], tx?: Prisma.TransactionClient): Promise<void>;
}

export const SEARCH_REPOSITORY = Symbol('SEARCH_REPOSITORY');
