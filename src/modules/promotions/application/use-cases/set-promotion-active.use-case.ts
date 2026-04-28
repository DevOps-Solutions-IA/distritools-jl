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
  PROMOTION_REPOSITORY,
  PromotionRepository,
} from 'src/modules/promotions/domain/repositories/promotion.repository';

@Injectable()
export class SetPromotionActiveUseCase {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(actor: CurrentUser, promotionId: string, active: boolean) {
    assertHasPermissions(actor.permissions, ['promotions.manage']);

    const existing = await this.promotionRepository.findById(promotionId);
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const updated = await this.promotionRepository.update({
      id: promotionId,
      isActive: active,
    });

    await this.auditRepository.write({
      actorUserId: actor.sub,
      action: active ? 'promotion.activated' : 'promotion.deactivated',
      entityType: 'promotion',
      entityId: promotionId,
      beforeData: existing,
      afterData: updated,
    });

    await this.domainEventPublisher.publish({
      eventName: active ? 'promotion.activated' : 'promotion.deactivated',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        promotionId: updated.id,
        slug: updated.slug,
      },
    });

    return updated;
  }
}
