import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';

export const SEARCH_REINDEX_BATCH_SIZE = 50;

@Injectable()
export class ReindexContentUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchRepository: SearchRepository,
  ) {}

  async execute(contentIds?: string[], tx?: Prisma.TransactionClient): Promise<{ reindexed: number }> {
    if (!tx) {
      contentIds = contentIds?.length ? contentIds : undefined;
      let cursor: string | null = null;
      let reindexed = 0;
      const upper = await this.upperBound(this.prisma, contentIds);
      for (;;) {
        const result = await this.prisma.$transaction((transaction) => this.batch(transaction, cursor, upper, contentIds));
        reindexed += result.reindexed;
        if (result.done) return { reindexed };
        cursor = result.cursor;
      }
    }
    if (!contentIds || contentIds.length > SEARCH_REINDEX_BATCH_SIZE) throw new Error('Explicit bounded content IDs required in a transaction');
    const where = contentIds.length
        ? {
            id: {
              in: contentIds,
            },
          }
        : { id: { in: [] as string[] } };
    const sourceIds = await tx.contentBlock.findMany({ where, select: { id: true } });
    for (const id of sourceIds.map((row) => row.id).sort()) {
      await this.searchRepository.lockContentProjection(tx, id);
    }
    const contentBlocks = await tx.contentBlock.findMany({
      where: { id: { in: sourceIds.map((row) => row.id) } },
    });

    await this.searchRepository.upsertContentDocuments(
      contentBlocks.map((contentBlock) => ({
        id: contentBlock.id,
        title: contentBlock.title,
        placementKey: contentBlock.placementKey,
        isPublished: contentBlock.isPublished,
        priority: contentBlock.priority,
        bodyText: JSON.stringify(contentBlock.body),
      })),
      tx,
    );

    return {
      reindexed: contentBlocks.length,
    };
  }

  async upperBound(tx: Prisma.TransactionClient, ids?: string[]) {
    const row = await tx.contentBlock.findFirst({ where: ids ? { id: { in: ids } } : undefined, orderBy: { id: 'desc' }, select: { id: true } });
    return row?.id ?? null;
  }

  async batch(tx: Prisma.TransactionClient, cursor: string | null, upper: string | null, ids?: string[]) {
    const rows = upper ? await tx.contentBlock.findMany({ where: {
      id: { ...(ids ? { in: ids } : {}), ...(cursor ? { gt: cursor } : {}), lte: upper },
    }, orderBy: { id: 'asc' }, take: SEARCH_REINDEX_BATCH_SIZE, select: { id: true } }) : [];
    const result = await this.execute(rows.map((row) => row.id), tx);
    return { ...result, cursor: rows.at(-1)?.id ?? cursor, done: rows.length < SEARCH_REINDEX_BATCH_SIZE };
  }
}
