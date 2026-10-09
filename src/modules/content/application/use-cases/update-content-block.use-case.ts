import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from 'src/common/events/domain-event.publisher';
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
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
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

    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const { body, ...fields } = input;
      const updated = await tx.contentBlock.update({
        where: { id: contentBlockId },
        data: { ...fields, ...(body === undefined ? {} : { body: body as Prisma.InputJsonValue }) },
      });
      // Reuse the publication contract for an edit of currently published content.
      // The transaction-current row also handles publication racing the initial read.
      const event = updated.isPublished ? await this.outbox.captureHeld(tx, {
        eventName: 'content.published', eventVersion: 'v1', occurredAt: new Date().toISOString(),
        payload: { contentId: updated.id, placementKey: updated.placementKey, title: updated.title },
      }) : null;
      await this.auditRepository.write({
        actorUserId: actor.sub,
        action: 'content.updated',
        entityType: 'content_block',
        entityId: contentBlockId,
        beforeData: existing,
        afterData: updated,
      }, tx);
      return { updated, event };
    });

    if (event) await this.domainEventPublisher.publish(event, event.route);
    return updated;
  }
}
