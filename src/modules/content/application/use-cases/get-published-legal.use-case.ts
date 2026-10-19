import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONTENT_REPOSITORY,
  ContentRepository,
} from 'src/modules/content/domain/repositories/content.repository';

@Injectable()
export class GetPublishedLegalUseCase {
  constructor(@Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepository) {}

  async execute(pageKey: string) {
    const publication = await this.contentRepository.findPublishedLegal(pageKey);
    if (!publication) throw new NotFoundException('Documento legal publicado no encontrado.');
    return publication;
  }
}
