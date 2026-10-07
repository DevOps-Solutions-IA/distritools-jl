import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
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

  async execute(input: SetBrandActiveInput) {
    assertHasPermissions(input.actor.permissions, ['brands.write']);

    const current = this.brandPolicyService.ensureExists(
      await this.brandRepository.findById(input.brandId),
    );

    const envelope = {
      eventName: 'brand.status_changed' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { brandId: current.id, slug: current.slug, isActive: input.isActive },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.brand.update({ where: { id: current.id }, data: { isActive: input.isActive } });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
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

    await this.domainEventPublisher.publish(event, event.route);

    return BrandEntity.fromState(updated).toAdminResponse();
  }
}
