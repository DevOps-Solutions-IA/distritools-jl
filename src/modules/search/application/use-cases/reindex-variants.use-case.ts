import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';
import { SEARCH_REINDEX_BATCH_SIZE } from './reindex-content.use-case';

function extractProductMetadataText(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const tags = Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === 'string') : [];
  const attributes = Array.isArray(record.attributes)
    ? record.attributes
        .flatMap((attribute) => {
          if (!attribute || typeof attribute !== 'object' || Array.isArray(attribute)) {
            return [];
          }

          const attributeRecord = attribute as Record<string, unknown>;
          return [attributeRecord.label, attributeRecord.value].filter(
            (value): value is string => typeof value === 'string',
          );
        })
    : [];

  return [
    typeof record.family === 'string' ? record.family : null,
    typeof record.subcategory === 'string' ? record.subcategory : null,
    typeof record.presentation === 'string' ? record.presentation : null,
    typeof record.longDescription === 'string' ? record.longDescription : null,
    ...tags,
    ...attributes,
  ]
    .filter(Boolean)
    .join(' ');
}

@Injectable()
export class ReindexVariantsUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchRepository: SearchRepository,
  ) {}

  async execute(variantIds?: string[], tx?: Prisma.TransactionClient): Promise<{ reindexed: number }> {
    if (!tx) {
      variantIds = variantIds?.length ? variantIds : undefined;
      let cursor: string | null = null;
      let reindexed = 0;
      const upper = await this.upperBound(this.prisma, variantIds);
      for (;;) {
        const result = await this.prisma.$transaction((transaction) => this.batch(transaction, cursor, upper, variantIds));
        reindexed += result.reindexed;
        if (result.done) return { reindexed };
        cursor = result.cursor;
      }
    }
    if (!variantIds || variantIds.length > SEARCH_REINDEX_BATCH_SIZE) throw new Error('Explicit bounded variant IDs required in a transaction');
    const where = variantIds.length
        ? {
            id: {
              in: variantIds,
            },
          }
        : { id: { in: [] as string[] } };
    const sourceIds = await tx.variant.findMany({ where, select: { id: true } });
    for (const id of sourceIds.map((row) => row.id).sort()) {
      await this.searchRepository.lockVariantProjection(tx, id);
    }
    const variants = await tx.variant.findMany({
      where: { id: { in: sourceIds.map((row) => row.id) } },
      include: {
        product: {
          include: {
            brand: true,
            category: true,
          },
        },
        inventoryItems: true,
      },
    });

    await this.searchRepository.upsertVariantDocuments(
      variants.map((variant) => {
        const product = variant.product as
          | {
              name: string;
              description: string | null;
              metadata: Prisma.JsonValue | null;
              brand: { name: string; slug: string } | null;
              category: { name: string; slug: string } | null;
            }
          | null;
        const metadataText = extractProductMetadataText(product?.metadata ?? null);

        return {
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          productName: product?.name ?? null,
          brandName: product?.brand?.name ?? null,
          brandSlug: product?.brand?.slug ?? null,
          categoryName: product?.category?.name ?? null,
          categorySlug: product?.category?.slug ?? null,
          description: product?.description ?? null,
          metadataText,
          isActive: variant.isActive,
          availability: variant.inventoryItems.reduce(
            (accumulator, inventoryItem) =>
              accumulator + (inventoryItem.onHandQty - inventoryItem.reservedQty),
            0,
          ),
        };
      }),
      tx,
    );

    return {
      reindexed: variants.length,
    };
  }

  async upperBound(tx: Prisma.TransactionClient, ids?: string[]) {
    const row = await tx.variant.findFirst({ where: ids ? { id: { in: ids } } : undefined, orderBy: { id: 'desc' }, select: { id: true } });
    return row?.id ?? null;
  }

  async batch(tx: Prisma.TransactionClient, cursor: string | null, upper: string | null, ids?: string[]) {
    const rows = upper ? await tx.variant.findMany({ where: {
      id: { ...(ids ? { in: ids } : {}), ...(cursor ? { gt: cursor } : {}), lte: upper },
    }, orderBy: { id: 'asc' }, take: SEARCH_REINDEX_BATCH_SIZE, select: { id: true } }) : [];
    const result = await this.execute(rows.map((row) => row.id), tx);
    return { ...result, cursor: rows.at(-1)?.id ?? cursor, done: rows.length < SEARCH_REINDEX_BATCH_SIZE };
  }
}
