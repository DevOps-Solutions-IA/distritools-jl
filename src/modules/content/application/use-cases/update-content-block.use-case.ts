import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  CONTENT_REPOSITORY,
  ContentRepository,
} from 'src/modules/content/domain/repositories/content.repository';

@Injectable()
export class UpdateContentBlockUseCase {
  constructor(
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(
    actor: CurrentUser,
    contentBlockId: string,
    input: {
      title?: string;
      slug?: string | null;
      placementKey?: string;
      body?: unknown;
      startsAt?: Date | null;
      endsAt?: Date | null;
      priority?: number;
    },
  ) {
    assertHasPermissions(actor.permissions, ['content.manage']);

    const existing = await this.contentRepository.findById(contentBlockId);
    if (!existing) {
      throw new NotFoundException('Content block not found');
    }

    const updated = await this.contentRepository.update({
      id: contentBlockId,
      ...input,
    });

    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'content.updated',
      entityType: 'content_block',
      entityId: contentBlockId,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }
}
