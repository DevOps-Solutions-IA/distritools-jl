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
  PROMOTION_REPOSITORY,
  PromotionRepository,
} from 'src/modules/promotions/domain/repositories/promotion.repository';

@Injectable()
export class SetPromotionActiveUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(actor: CurrentUser, promotionId: string, active: boolean) {
    assertHasPermissions(actor.permissions, ['promotions.manage']);

    const existing = await this.promotionRepository.findById(promotionId);
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const envelope = {
      eventName: active ? 'promotion.activated' as const : 'promotion.deactivated' as const,
      eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { promotionId: existing.id, slug: existing.slug },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.promotion.update({ where: { id: promotionId }, data: { isActive: active } });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });

    const updatedState = {
      ...updated,
      value: updated.value.toFixed(2),
      minSubtotal: updated.minSubtotal?.toFixed(2) ?? null,
    };
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: active ? 'promotion.activated' : 'promotion.deactivated',
      entityType: 'promotion',
      entityId: promotionId,
      beforeData: existing,
      afterData: updatedState,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return updatedState;
  }
}
