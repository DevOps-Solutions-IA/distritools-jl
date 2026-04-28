import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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
export class CreateContentBlockUseCase {
  constructor(
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    actor: CurrentUser,
    input: {
      title: string;
      slug?: string | null;
      type: 'banner' | 'hero' | 'text_section' | 'featured_brand';
      placementKey: string;
      body: unknown;
      isPublished?: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
      priority?: number;
    },
  ) {
    assertHasPermissions(actor.permissions, ['content.manage']);

    const contentBlock = await this.contentRepository.create({
      id: uuidv7(),
      ...input,
    });

    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'content.created',
      entityType: 'content_block',
      entityId: contentBlock.id,
      afterData: contentBlock,
    });

    if (contentBlock.isPublished) {
      await this.domainEventPublisher.publish({
        eventName: 'content.published',
        eventVersion: 'v1',
        occurredAt: new Date().toISOString(),
        payload: {
          contentId: contentBlock.id,
          placementKey: contentBlock.placementKey,
          title: contentBlock.title,
        },
      });
    }

    return contentBlock;
  }
}
