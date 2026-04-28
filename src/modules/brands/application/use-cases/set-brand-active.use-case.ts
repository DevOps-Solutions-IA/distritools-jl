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

export interface SetBrandActiveInput {
  actor: CurrentUser;
  brandId: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SetBrandActiveUseCase {
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

  async execute(input: SetBrandActiveInput) {
    assertHasPermissions(input.actor.permissions, ['brands.manage']);

    const current = this.brandPolicyService.ensureExists(
      await this.brandRepository.findById(input.brandId),
    );

    const updated = await this.brandRepository.update({
      id: current.id,
      isActive: input.isActive,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: input.isActive ? 'brand.activated' : 'brand.deactivated',
      entityType: 'brand',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'brand.status_changed',
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
