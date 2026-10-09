import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { parsePageSize } from 'src/common/utils/pagination.util';
import {
  ContentIndexSource,
  SearchRepository,
  VariantIndexSource,
} from 'src/modules/search/domain/repositories/search.repository';

const PUBLIC_SEARCH_FIELDS = {
  id: true, documentType: true, title: true, subtitle: true, sku: true,
  brandName: true, brandSlug: true, categoryName: true, categorySlug: true,
  placementKey: true, availability: true, priority: true,
} satisfies Prisma.SearchDocumentSelect;

function validateSearchText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new BadRequestException(`${field} debe ser texto de hasta 256 caracteres sin controles.`);
  }
  return value.trim();
}

// Match public variants and content, including time transitions without an event.
function currentEligibility(at = new Date()): Prisma.SearchDocumentWhereInput {
  return { OR: [
    { documentType: 'variant', variant: { is: {
      isActive: true, OR: [{ productId: null }, { product: { is: { isActive: true } } }],
    } } },
    { documentType: 'content', contentBlock: { is: {
      isPublished: true,
      OR: [{ startsAt: null }, { startsAt: { lte: at } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: at } }] }],
    } } },
  ] };
}

@Injectable()
export class PrismaSearchRepository implements SearchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async lockVariantProjection(tx: Prisma.TransactionClient, variantId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`search:variant:${variantId}`}, 0))::text`);
  }

  async lockContentProjection(tx: Prisma.TransactionClient, contentId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`search:content:${contentId}`}, 0))::text`);
  }

  async search(
    query: string,
    options: { limit?: number; brandSlug?: string; categorySlug?: string } = {},
  ) {
    const normalizedQuery = validateSearchText(query, 'q').toLowerCase();
    const limit = parsePageSize(options.limit);
    const brandSlug = options.brandSlug === undefined ? undefined : validateSearchText(options.brandSlug, 'brandSlug');
    const categorySlug = options.categorySlug === undefined ? undefined : validateSearchText(options.categorySlug, 'categorySlug');
    if (!normalizedQuery) {
      return [];
    }

    const results = await this.prisma.searchDocument.findMany({
      where: {
        isActive: true,
        AND: [currentEligibility()],
        ...(brandSlug ? { brandSlug } : {}),
        ...(categorySlug ? { categorySlug } : {}),
        OR: [
          { title: { contains: normalizedQuery, mode: 'insensitive' } },
          { subtitle: { contains: normalizedQuery, mode: 'insensitive' } },
          { sku: { contains: normalizedQuery, mode: 'insensitive' } },
          { brandName: { contains: normalizedQuery, mode: 'insensitive' } },
          { categoryName: { contains: normalizedQuery, mode: 'insensitive' } },
          { searchText: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      select: { ...PUBLIC_SEARCH_FIELDS, variantId: true },
      orderBy: [{ priority: 'desc' }, { availability: 'desc' }, { title: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    // Inventory writes have no search event in the current contract. Hydrate only
    // the bounded result set rather than returning an obsolete stock snapshot.
    const variantIds = results.flatMap((row) => row.documentType === 'variant' && row.variantId ? [row.variantId] : []);
    const stock = variantIds.length ? await this.prisma.inventoryItem.groupBy({
      by: ['variantId'], where: { variantId: { in: variantIds } },
      _sum: { onHandQty: true, reservedQty: true, committedQty: true },
    }) : [];
    const availability = new Map(stock.map((row) => [row.variantId,
      (row._sum.onHandQty ?? 0) - (row._sum.reservedQty ?? 0) - (row._sum.committedQty ?? 0),
    ]));
    return results.map(({ variantId, ...record }) => {
      if (record.documentType !== 'variant') return record;
      const currentStock = availability.get(variantId!) ?? 0;
      return { ...record, availability: currentStock, priority: currentStock > 0 ? 10 : 0 };
    });
  }

  async autocomplete(query: string, limit = 10) {
    const normalizedQuery = validateSearchText(query, 'q').toLowerCase();
    limit = parsePageSize(limit, 10);
    if (!normalizedQuery) {
      return [];
    }

    const results = await this.prisma.searchDocument.findMany({
      where: {
        isActive: true,
        AND: [currentEligibility()],
        OR: [
          { sku: { startsWith: normalizedQuery, mode: 'insensitive' } },
          { title: { startsWith: normalizedQuery, mode: 'insensitive' } },
          { brandName: { startsWith: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      select: PUBLIC_SEARCH_FIELDS,
      orderBy: [{ priority: 'desc' }, { availability: 'desc' }, { title: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    return [...new Set(results.map((result: (typeof results)[number]) => result.sku || result.title))];
  }

  async upsertVariantDocuments(documents: VariantIndexSource[], tx?: Prisma.TransactionClient): Promise<void> {
    if (!tx) return this.prisma.$transaction((transaction) => this.upsertVariantDocuments(documents, transaction));
    const client = tx ?? this.prisma;
    for (const document of documents) {
      const existing = await client.searchDocument.findFirst({
        where: {
          variantId: document.id,
          documentType: 'variant',
        },
      });

      await client.searchDocument.upsert({
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

  async upsertContentDocuments(documents: ContentIndexSource[], tx?: Prisma.TransactionClient): Promise<void> {
    if (!tx) return this.prisma.$transaction((transaction) => this.upsertContentDocuments(documents, transaction));
    const client = tx ?? this.prisma;
    for (const document of documents) {
      const existing = await client.searchDocument.findFirst({
        where: {
          contentBlockId: document.id,
          documentType: 'content',
        },
      });

      await client.searchDocument.upsert({
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
