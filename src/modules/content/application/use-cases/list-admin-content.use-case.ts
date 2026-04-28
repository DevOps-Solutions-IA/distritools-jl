import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { ContentBlockEntity } from 'src/modules/content/domain/entities/content-block.entity';
import {
  CONTENT_REPOSITORY,
  ContentRepository,
} from 'src/modules/content/domain/repositories/content.repository';

@Injectable()
export class ListAdminContentUseCase {
  constructor(
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepository,
  ) {}

  async execute(actor: CurrentUser) {
    assertHasPermissions(actor.permissions, ['content.manage']);

    const records = await this.contentRepository.listAll();

    return {
      data: records.map((record) => ContentBlockEntity.fromState(record).toResponse()),
    };
  }
}
