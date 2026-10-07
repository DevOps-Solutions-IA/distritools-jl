import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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

export interface CreateVariantInput {
  actor: CurrentUser;
  productId?: string | null;
  sku: string;
  name: string;
  price: string;
  taxRate?: string;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateVariantUseCase {
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

  async execute(input: CreateVariantInput) {
    assertHasPermissions(input.actor.permissions, ['products.write']);

    const sku = this.variantPolicyService.normalizeSku(input.sku);
    this.variantPolicyService.ensureSkuAvailable(
      await this.variantRepository.findBySku(sku),
    );

    if (input.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    const variantData = {
      id: uuidv7(),
      productId: input.productId ?? null,
      sku,
      name: this.variantPolicyService.normalizeName(input.name),
      price: this.variantPolicyService.ensurePrice(input.price),
      taxRate: this.variantPolicyService.ensureTaxRate(input.taxRate ?? '0'),
      isActive: input.isActive ?? true,
    };
    const envelope = {
      eventName: 'variant.created' as const, eventVersion: 'v1' as const, occurredAt: new Date().toISOString(),
      payload: { variantId: variantData.id, productId: variantData.productId, sku: variantData.sku, isActive: variantData.isActive },
    };
    const { variant, event } = await this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.create({
        data: variantData,
        include: { product: { include: { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } } } },
      });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { variant, event };
    });

    const variantState = {
      ...variant,
      price: variant.price.toFixed(2),
      taxRate: variant.taxRate.toFixed(2),
      product: variant.product ? {
        id: variant.product.id, name: variant.product.name, slug: variant.product.slug,
        isActive: variant.product.isActive, brand: variant.product.brand, category: variant.product.category,
      } : null,
    };
    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'variant.created',
      entityType: 'variant',
      entityId: variant.id,
      afterData: variantState,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return VariantEntity.fromState(variantState).toAdminResponse();
  }
}
