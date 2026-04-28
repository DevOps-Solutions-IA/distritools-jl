import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  PROMOTION_REPOSITORY,
  PromotionRepository,
} from 'src/modules/promotions/domain/repositories/promotion.repository';

export interface UpdatePromotionInput {
  actor: CurrentUser;
  promotionId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  priority?: number;
  value?: string;
  minSubtotal?: string | null;
  minQuantity?: number | null;
  targetIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdatePromotionUseCase {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: UpdatePromotionInput) {
    assertHasPermissions(input.actor.permissions, ['promotions.manage']);

    const existing = await this.promotionRepository.findById(input.promotionId);
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const normalizedSlug = input.slug?.trim().toLowerCase();
    if (normalizedSlug && normalizedSlug !== existing.slug) {
      const conflicting = await this.promotionRepository.findBySlug(normalizedSlug);
      if (conflicting) {
        throw new ConflictException('Promotion slug already exists');
      }
    }

    const updated = await this.promotionRepository.update({
      id: input.promotionId,
      name: input.name?.trim(),
      slug: normalizedSlug,
      description:
        input.description === undefined ? undefined : input.description?.trim() || null,
      priority: input.priority,
      value: input.value,
      minSubtotal: input.minSubtotal,
      minQuantity: input.minQuantity,
      targetIds: input.targetIds,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'promotion.updated',
      entityType: 'promotion',
      entityId: updated.id,
      beforeData: existing,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return updated;
  }
}
