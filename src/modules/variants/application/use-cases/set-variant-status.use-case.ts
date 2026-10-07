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
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(VARIANT_REPOSITORY)
    private readonly variantRepository: VariantRepository,
    @Inject(VariantPolicyService)
    private readonly variantPolicyService: VariantPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(input: SetVariantStatusInput) {
    assertHasPermissions(input.actor.permissions, [
      input.isActive ? 'products.publish' : 'products.write',
    ]);

    const current = this.variantPolicyService.ensureExists(
      await this.variantRepository.findById(input.variantId),
    );

    const envelope = {
      eventName: 'variant.status_changed' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { variantId: current.id, productId: current.productId, sku: current.sku, isActive: input.isActive },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.variant.update({
        where: { id: current.id }, data: { isActive: input.isActive },
        include: { product: { include: { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } } } },
      });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });

    const updatedState = {
      ...updated,
      price: updated.price.toFixed(2),
      taxRate: updated.taxRate.toFixed(2),
      product: updated.product ? {
        id: updated.product.id, name: updated.product.name, slug: updated.product.slug,
        isActive: updated.product.isActive, brand: updated.product.brand, category: updated.product.category,
      } : null,
    };
    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: input.isActive ? 'variant.activated' : 'variant.deactivated',
      entityType: 'variant',
      entityId: updated.id,
      beforeData: current,
      afterData: updatedState,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return VariantEntity.fromState(updatedState).toAdminResponse();
  }
}
