import { Inject, Injectable } from '@nestjs/common';
import { ContentBlockEntity } from 'src/modules/content/domain/entities/content-block.entity';
import {
  CONTENT_REPOSITORY,
  ContentRepository,
} from 'src/modules/content/domain/repositories/content.repository';
import { ContentPublicationService } from 'src/modules/content/domain/services/content-publication.service';

@Injectable()
export class ListPublicContentUseCase {
  constructor(
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepository,
    @Inject(ContentPublicationService)
    private readonly contentPublicationService: ContentPublicationService,
  ) {}

  async execute(placementKey?: string) {
    const records = await this.contentRepository.listVisible(placementKey, new Date());

    return {
      data: this.contentPublicationService
        .filterVisible(
          records.map((record) => ContentBlockEntity.fromState(record)),
          new Date(),
        )
        .map((contentBlock) => contentBlock.toResponse()),
    };
  }
}
