import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
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
  ) {}

  async execute(input: UpdateVariantInput) {
    assertHasPermissions(input.actor.permissions, ['variants.manage']);

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

    const updated = await this.variantRepository.update({
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
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'variant.updated',
      entityType: 'variant',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'variant.updated',
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
