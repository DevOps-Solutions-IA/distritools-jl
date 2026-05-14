import { Prisma } from '@prisma/client';
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
    @Inject(BRAND_REPOSITORY)
    private readonly brandRepository: BrandRepository,
    @Inject(BrandPolicyService)
    private readonly brandPolicyService: BrandPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
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

    const updated = await this.brandRepository.update({
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

    await this.domainEventPublisher.publish({
      eventName: 'brand.updated',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        brandId: updated.id,
        slug: updated.slug,
        isActive: updated.isActive,
      },
    });

    return BrandEntity.fromState(updated).toAdminResponse();
  }
}
