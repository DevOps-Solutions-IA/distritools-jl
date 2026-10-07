import { Prisma } from '@prisma/client';
import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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

  async execute(input: CreatePromotionInput) {
    assertHasPermissions(input.actor.permissions, ['promotions.manage']);

    const normalizedSlug = input.slug.trim().toLowerCase();
    const existing = await this.promotionRepository.findBySlug(normalizedSlug);

    if (existing) {
      throw new ConflictException('Promotion slug already exists');
    }

    const promotionData = {
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
    };
    const envelope = promotionData.isActive ? {
      eventName: 'promotion.activated' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { promotionId: promotionData.id, slug: promotionData.slug },
    } : null;
    const { promotion, event } = await this.prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.create({
        data: { ...promotionData, targetIds: promotionData.targetIds as unknown as Prisma.InputJsonValue },
      });
      const event = envelope ? await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope) : null;
      return { promotion, event };
    });

    const promotionState = {
      ...promotion,
      value: promotion.value.toFixed(2),
      minSubtotal: promotion.minSubtotal?.toFixed(2) ?? null,
    };
    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'promotion.created',
      entityType: 'promotion',
      entityId: promotion.id,
      afterData: promotionState,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    if (event) await this.domainEventPublisher.publish(event, event.route);

    return promotionState;
  }
}
