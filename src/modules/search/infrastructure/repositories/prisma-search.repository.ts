import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  ContentIndexSource,
  SearchRepository,
  VariantIndexSource,
} from 'src/modules/search/domain/repositories/search.repository';

@Injectable()
export class PrismaSearchRepository implements SearchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(
    query: string,
    options: { limit?: number; brandSlug?: string; categorySlug?: string } = {},
  ) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return this.prisma.searchDocument.findMany({
      where: {
        isActive: true,
        ...(options.brandSlug ? { brandSlug: options.brandSlug } : {}),
        ...(options.categorySlug ? { categorySlug: options.categorySlug } : {}),
        OR: [
          { title: { contains: normalizedQuery, mode: 'insensitive' } },
          { subtitle: { contains: normalizedQuery, mode: 'insensitive' } },
          { sku: { contains: normalizedQuery, mode: 'insensitive' } },
          { brandName: { contains: normalizedQuery, mode: 'insensitive' } },
          { categoryName: { contains: normalizedQuery, mode: 'insensitive' } },
          { searchText: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { availability: 'desc' }, { title: 'asc' }],
      take: options.limit ?? 20,
    });
  }

  async autocomplete(query: string, limit = 10) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const results = await this.prisma.searchDocument.findMany({
      where: {
        isActive: true,
        OR: [
          { sku: { startsWith: normalizedQuery, mode: 'insensitive' } },
          { title: { startsWith: normalizedQuery, mode: 'insensitive' } },
          { brandName: { startsWith: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { availability: 'desc' }, { title: 'asc' }],
      take: limit,
    });

    return [...new Set(results.map((result: (typeof results)[number]) => result.sku || result.title))];
  }

  async upsertVariantDocuments(documents: VariantIndexSource[]) {
    for (const document of documents) {
      const existing = await this.prisma.searchDocument.findFirst({
        where: {
          variantId: document.id,
          documentType: 'variant',
        },
      });

      await this.prisma.searchDocument.upsert({
        where: {
          id: existing?.id ?? uuidv7(),
        },
        update: {
          title: document.productName ?? document.name,
          subtitle: document.name,
          sku: document.sku,
          brandName: document.brandName,
          brandSlug: document.brandSlug,
          categoryName: document.categoryName,
          categorySlug: document.categorySlug,
          searchText: [
            document.productName,
            document.name,
            document.sku,
            document.brandName,
            document.categoryName,
            document.description,
            document.metadataText,
          ]
            .filter(Boolean)
            .join(' '),
          isActive: document.isActive,
          availability: document.availability,
          priority: document.availability > 0 ? 10 : 0,
          variantId: document.id,
          contentBlockId: null,
          placementKey: null,
          documentType: 'variant',
        },
        create: {
          id: existing?.id ?? uuidv7(),
          documentType: 'variant',
          variantId: document.id,
          title: document.productName ?? document.name,
          subtitle: document.name,
          sku: document.sku,
          brandName: document.brandName,
          brandSlug: document.brandSlug,
          categoryName: document.categoryName,
          categorySlug: document.categorySlug,
          searchText: [
            document.productName,
            document.name,
            document.sku,
            document.brandName,
            document.categoryName,
            document.description,
            document.metadataText,
          ]
            .filter(Boolean)
            .join(' '),
          isActive: document.isActive,
          availability: document.availability,
          priority: document.availability > 0 ? 10 : 0,
        },
      });
    }
  }

  async upsertContentDocuments(documents: ContentIndexSource[]) {
    for (const document of documents) {
      const existing = await this.prisma.searchDocument.findFirst({
        where: {
          contentBlockId: document.id,
          documentType: 'content',
        },
      });

      await this.prisma.searchDocument.upsert({
        where: {
          id: existing?.id ?? uuidv7(),
        },
        update: {
          documentType: 'content',
          contentBlockId: document.id,
          title: document.title,
          subtitle: null,
          sku: null,
          brandName: null,
          brandSlug: null,
          categoryName: null,
          categorySlug: null,
          placementKey: document.placementKey,
          searchText: `${document.title} ${document.bodyText}`.trim(),
          isActive: document.isPublished,
          availability: 0,
          priority: document.priority,
          variantId: null,
        },
        create: {
          id: existing?.id ?? uuidv7(),
          documentType: 'content',
          contentBlockId: document.id,
          title: document.title,
          placementKey: document.placementKey,
          searchText: `${document.title} ${document.bodyText}`.trim(),
          isActive: document.isPublished,
          availability: 0,
          priority: document.priority,
          brandSlug: null,
          categorySlug: null,
        },
      });
    }
  }
}
