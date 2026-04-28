import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import {
  CONTENT_REPOSITORY,
  ContentRepository,
} from 'src/modules/content/domain/repositories/content.repository';

@Injectable()
export class SetContentPublishedUseCase {
  constructor(
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(actor: CurrentUser, contentBlockId: string, published: boolean) {
    assertHasPermissions(actor.permissions, ['content.manage']);

    const existing = await this.contentRepository.findById(contentBlockId);
    if (!existing) {
      throw new NotFoundException('Content block not found');
    }

    const updated = await this.contentRepository.update({
      id: contentBlockId,
      isPublished: published,
    });

    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: published ? 'content.published' : 'content.unpublished',
      entityType: 'content_block',
      entityId: contentBlockId,
      beforeData: existing,
      afterData: updated,
    });

    await this.domainEventPublisher.publish({
      eventName: published ? 'content.published' : 'content.unpublished',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        contentId: updated.id,
        placementKey: updated.placementKey,
        title: updated.title,
      },
    });

    return updated;
  }
}
