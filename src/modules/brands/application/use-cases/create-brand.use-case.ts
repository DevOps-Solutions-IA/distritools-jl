import { Prisma } from '@prisma/client';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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
import {
  BRAND_REPOSITORY,
  BrandRepository,
} from 'src/modules/brands/domain/repositories/brand.repository';
import { BrandEntity } from 'src/modules/brands/domain/entities/brand.entity';
import { BrandPolicyService } from 'src/modules/brands/domain/services/brand-policy.service';

export interface CreateBrandInput {
  actor: CurrentUser;
  name: string;
  slug: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateBrandUseCase {
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

  async execute(input: CreateBrandInput) {
    assertHasPermissions(input.actor.permissions, ['brands.write']);

    const name = this.brandPolicyService.normalizeName(input.name);
    const slug = this.brandPolicyService.normalizeSlug(input.slug);
    const metadata = this.brandPolicyService.normalizeMetadata(input.metadata);
    const existing = await this.brandRepository.findBySlug(slug);
    this.brandPolicyService.ensureSlugAvailable(existing);

    if (existing) {
      throw new ConflictException('Brand slug already exists');
    }

    const brand = await this.brandRepository.create({
      id: uuidv7(),
      name,
      slug,
      description: input.description?.trim() || null,
      metadata: metadata ?? Prisma.JsonNull,
      isActive: input.isActive ?? true,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'brand.created',
      entityType: 'brand',
      entityId: brand.id,
      afterData: brand,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'brand.created',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        brandId: brand.id,
        slug: brand.slug,
        isActive: brand.isActive,
      },
    });

    return BrandEntity.fromState(brand).toAdminResponse();
  }
}
