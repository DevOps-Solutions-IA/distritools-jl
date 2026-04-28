import { Inject, Injectable, ConflictException } from '@nestjs/common';
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
  PROMOTION_REPOSITORY,
  PromotionRepository,
} from 'src/modules/promotions/domain/repositories/promotion.repository';

export interface CreatePromotionInput {
  actor: CurrentUser;
  name: string;
  slug: string;
  description?: string | null;
  type: 'percentage' | 'fixed_amount';
  scope: 'line' | 'cart';
  stackingMode: 'exclusive' | 'stackable_same_scope' | 'stackable_cross_scope';
  priority: number;
  value: string;
  minSubtotal?: string | null;
  minQuantity?: number | null;
  targetType: 'all' | 'product' | 'variant' | 'category' | 'brand';
  targetIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreatePromotionUseCase {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: CreatePromotionInput) {
    assertHasPermissions(input.actor.permissions, ['promotions.manage']);

    const normalizedSlug = input.slug.trim().toLowerCase();
    const existing = await this.promotionRepository.findBySlug(normalizedSlug);

    if (existing) {
      throw new ConflictException('Promotion slug already exists');
    }

    const promotion = await this.promotionRepository.create({
      id: uuidv7(),
      name: input.name.trim(),
      slug: normalizedSlug,
      description: input.description?.trim() || null,
      type: input.type,
      scope: input.scope,
      stackingMode: input.stackingMode,
      priority: input.priority,
      value: input.value,
      minSubtotal: input.minSubtotal ?? null,
      minQuantity: input.minQuantity ?? null,
      targetType: input.targetType,
      targetIds: input.targetIds ?? [],
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive ?? false,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'promotion.created',
      entityType: 'promotion',
      entityId: promotion.id,
      afterData: promotion,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    if (promotion.isActive) {
      await this.domainEventPublisher.publish({
        eventName: 'promotion.activated',
        eventVersion: 'v1',
        occurredAt: new Date().toISOString(),
        payload: {
          promotionId: promotion.id,
          slug: promotion.slug,
        },
      });
    }

    return promotion;
  }
}
