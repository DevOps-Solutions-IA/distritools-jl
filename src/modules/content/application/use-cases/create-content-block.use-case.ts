import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
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

    const contentData = {
      id: uuidv7(),
      ...input,
    };
    const envelope = contentData.isPublished ? {
      eventName: 'content.published' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { contentId: contentData.id, placementKey: contentData.placementKey, title: contentData.title },
    } : null;
    const { contentBlock, event } = await this.prisma.$transaction(async (tx) => {
      const contentBlock = await tx.contentBlock.create({
        data: { ...contentData, body: contentData.body as Prisma.InputJsonValue },
      });
      const event = envelope ? await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope) : null;
      return { contentBlock, event };
    });

    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: 'content.created',
      entityType: 'content_block',
      entityId: contentBlock.id,
      afterData: contentBlock,
    });

    if (event) await this.domainEventPublisher.publish(event, event.route);

    return contentBlock;
  }
}
