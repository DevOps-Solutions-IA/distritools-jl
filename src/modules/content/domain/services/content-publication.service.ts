import { Injectable } from '@nestjs/common';
import { ContentBlockEntity } from 'src/modules/content/domain/entities/content-block.entity';

@Injectable()
export class ContentPublicationService {
  filterVisible(contentBlocks: ContentBlockEntity[], at: Date): ContentBlockEntity[] {
    return contentBlocks
      .filter((contentBlock) => contentBlock.isVisibleAt(at))
      .sort(
        (left, right) =>
          right.toResponse().priority - left.toResponse().priority ||
          left.toResponse().title.localeCompare(right.toResponse().title),
      );
  }
}
