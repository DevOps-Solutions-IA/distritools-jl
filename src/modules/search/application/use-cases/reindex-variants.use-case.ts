import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';

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

  async execute(variantIds?: string[]) {
    const variants = await this.prisma.variant.findMany({
      where: variantIds?.length
        ? {
            id: {
              in: variantIds,
            },
          }
        : undefined,
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
    );

    return {
      reindexed: variants.length,
    };
  }
}
