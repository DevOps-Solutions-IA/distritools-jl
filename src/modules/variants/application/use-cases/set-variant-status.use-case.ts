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
import { VariantEntity } from 'src/modules/variants/domain/entities/variant.entity';
import {
  VARIANT_REPOSITORY,
  VariantRepository,
} from 'src/modules/variants/domain/repositories/variant.repository';
import { VariantPolicyService } from 'src/modules/variants/domain/services/variant-policy.service';

export interface SetVariantStatusInput {
  actor: CurrentUser;
  variantId: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SetVariantStatusUseCase {
  constructor(
    @Inject(VARIANT_REPOSITORY)
    private readonly variantRepository: VariantRepository,
    @Inject(VariantPolicyService)
    private readonly variantPolicyService: VariantPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: SetVariantStatusInput) {
    assertHasPermissions(input.actor.permissions, ['variants.manage']);

    const current = this.variantPolicyService.ensureExists(
      await this.variantRepository.findById(input.variantId),
    );

    const updated = await this.variantRepository.update({
      id: current.id,
      isActive: input.isActive,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: input.isActive ? 'variant.activated' : 'variant.deactivated',
      entityType: 'variant',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'variant.status_changed',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        variantId: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        isActive: updated.isActive,
      },
    });

    return VariantEntity.fromState(updated).toAdminResponse();
  }
}
