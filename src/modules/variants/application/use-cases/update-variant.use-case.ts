import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

export interface UpdateVariantInput {
  actor: CurrentUser;
  variantId: string;
  productId?: string | null;
  sku?: string;
  name?: string;
  price?: string;
  taxRate?: string;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateVariantUseCase {
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

  async execute(input: UpdateVariantInput) {
    assertHasPermissions(input.actor.permissions, ['products.write']);

    const current = this.variantPolicyService.ensureExists(
      await this.variantRepository.findById(input.variantId),
    );

    const sku =
      input.sku !== undefined
        ? this.variantPolicyService.normalizeSku(input.sku)
        : current.sku;

    if (sku !== current.sku) {
      this.variantPolicyService.ensureSkuAvailable(
        await this.variantRepository.findBySku(sku),
        current.id,
      );
    }

    const nextProductId =
      input.productId !== undefined ? input.productId : current.productId;

    if (nextProductId) {
      const product = await this.prisma.product.findUnique({
        where: { id: nextProductId },
        select: { id: true },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    const updateData = {
      id: current.id,
      productId: nextProductId,
      sku,
      name:
        input.name !== undefined
          ? this.variantPolicyService.normalizeName(input.name)
          : current.name,
      price:
        input.price !== undefined
          ? this.variantPolicyService.ensurePrice(input.price)
          : current.price,
      taxRate:
        input.taxRate !== undefined
          ? this.variantPolicyService.ensureTaxRate(input.taxRate)
          : current.taxRate,
      isActive:
        input.isActive !== undefined
          ? input.isActive
          : current.isActive,
    };
    const envelope = {
      eventName: 'variant.updated' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { variantId: current.id, productId: updateData.productId, sku: updateData.sku, isActive: updateData.isActive },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const { id, ...data } = updateData;
      const updated = await tx.variant.update({
        where: { id }, data,
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
      action: 'variant.updated',
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
