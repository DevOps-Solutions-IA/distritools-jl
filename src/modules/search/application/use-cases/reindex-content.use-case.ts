import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SEARCH_REPOSITORY,
  SearchRepository,
} from 'src/modules/search/domain/repositories/search.repository';

@Injectable()
export class ReindexContentUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchRepository: SearchRepository,
  ) {}

  async execute(contentIds?: string[]) {
    const contentBlocks = await this.prisma.contentBlock.findMany({
      where: contentIds?.length
        ? {
            id: {
              in: contentIds,
            },
          }
        : undefined,
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
    );

    return {
      reindexed: contentBlocks.length,
    };
  }
}
