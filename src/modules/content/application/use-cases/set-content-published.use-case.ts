import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
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
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(actor: CurrentUser, contentBlockId: string, published: boolean) {
    assertHasPermissions(actor.permissions, ['content.manage']);

    const existing = await this.contentRepository.findById(contentBlockId);
    if (!existing) {
      throw new NotFoundException('Content block not found');
    }

    const envelope = {
      eventName: published ? 'content.published' as const : 'content.unpublished' as const,
      eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { contentId: existing.id, placementKey: existing.placementKey, title: existing.title },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contentBlock.update({ where: { id: contentBlockId }, data: { isPublished: published } });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });

    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: published ? 'content.published' : 'content.unpublished',
      entityType: 'content_block',
      entityId: contentBlockId,
      beforeData: existing,
      afterData: updated,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return updated;
  }
}
