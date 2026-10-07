import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { BrandEntity } from 'src/modules/brands/domain/entities/brand.entity';
import {
  BRAND_REPOSITORY,
  BrandRepository,
} from 'src/modules/brands/domain/repositories/brand.repository';
import { BrandPolicyService } from 'src/modules/brands/domain/services/brand-policy.service';

export interface UpdateBrandInput {
  actor: CurrentUser;
  brandId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateBrandUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BRAND_REPOSITORY)
    private readonly brandRepository: BrandRepository,
    @Inject(BrandPolicyService)
    private readonly brandPolicyService: BrandPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(input: UpdateBrandInput) {
    assertHasPermissions(input.actor.permissions, ['brands.write']);

    const current = this.brandPolicyService.ensureExists(
      await this.brandRepository.findById(input.brandId),
    );

    const slug =
      input.slug !== undefined
        ? this.brandPolicyService.normalizeSlug(input.slug)
        : current.slug;

    if (slug !== current.slug) {
      const existing = await this.brandRepository.findBySlug(slug);
      this.brandPolicyService.ensureSlugAvailable(existing, current.id);
    }

    const updateData = {
      id: current.id,
      name:
        input.name !== undefined
          ? this.brandPolicyService.normalizeName(input.name)
          : current.name,
      slug,
      description:
        input.description !== undefined ? input.description?.trim() || null : current.description,
      metadata:
        input.metadata !== undefined
          ? this.brandPolicyService.normalizeMetadata(input.metadata) ?? Prisma.JsonNull
          : current.metadata === null
            ? Prisma.JsonNull
            : current.metadata,
    };
    const envelope = {
      eventName: 'brand.updated' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { brandId: current.id, slug: updateData.slug, isActive: current.isActive },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const { id, ...data } = updateData;
      const updated = await tx.brand.update({ where: { id }, data });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'brand.updated',
      entityType: 'brand',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return BrandEntity.fromState(updated).toAdminResponse();
  }
}
