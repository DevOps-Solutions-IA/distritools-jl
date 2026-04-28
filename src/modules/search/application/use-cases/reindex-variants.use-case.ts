import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';

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
              brand: { name: string; slug: string } | null;
              category: { name: string; slug: string } | null;
            }
          | null;

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
