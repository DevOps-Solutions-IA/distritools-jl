import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
import { ProductEntity } from 'src/modules/products/domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from 'src/modules/products/domain/repositories/product.repository';
import { evaluateProductSellability } from 'src/modules/products/domain/services/catalog-sellability.service';
import { ProductPolicyService } from 'src/modules/products/domain/services/product-policy.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export interface SetProductStatusInput {
  actor: CurrentUser;
  productId: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SetProductStatusUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
    @Inject(ProductPolicyService)
    private readonly productPolicyService: ProductPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
  ) {}

  async execute(input: SetProductStatusInput) {
    assertHasPermissions(input.actor.permissions, [input.isActive ? 'products.publish' : 'products.write']);

    const current = this.productPolicyService.ensureExists(
      await this.productRepository.findById(input.productId),
    );

    if (input.isActive) {
      const product = await this.prisma.product.findUnique({
        where: { id: input.productId },
        include: {
          brand: { select: { id: true, name: true, slug: true, isActive: true } },
          category: { select: { id: true, name: true, slug: true, isActive: true } },
          variants: { include: { inventoryItems: true } },
        },
      });
      const evaluation = product
        ? evaluateProductSellability({ ...product, isActive: true })
        : null;
      const publishBlockers = [
        ...(evaluation?.blockers ?? []),
        ...(evaluation?.warnings ?? []).filter((warning) =>
          ['MISSING_DIMENSIONS', 'MISSING_MAIN_IMAGE'].includes(warning),
        ),
      ];
      if (publishBlockers.length) {
        throw new BadRequestException(
          `No se puede activar un producto incompleto: ${publishBlockers.join(', ')}`,
        );
      }
    }

    const envelope = {
      eventName: 'product.status_changed' as const,
      eventVersion: 'v1' as const,
      occurredAt: new Date().toISOString(),
      payload: { productId: current.id, slug: current.slug, isActive: input.isActive },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: current.id }, data: { isActive: input.isActive },
        include: { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
      });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: input.isActive ? 'product.activated' : 'product.deactivated',
      entityType: 'product',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return ProductEntity.fromState(updated).toAdminResponse();
  }
}
