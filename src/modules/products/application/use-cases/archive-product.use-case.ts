import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
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
import { ProductEntity } from 'src/modules/products/domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from 'src/modules/products/domain/repositories/product.repository';
import { ProductPolicyService } from 'src/modules/products/domain/services/product-policy.service';

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

@Injectable()
export class ArchiveProductUseCase {
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

  async execute(input: {
    actor: CurrentUser;
    productId: string;
    reason?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    assertHasPermissions(input.actor.permissions, ['products.archive']);

    const current = this.productPolicyService.ensureExists(
      await this.productRepository.findById(input.productId),
    );
    const metadata = {
      ...asMetadata(current.metadata),
      catalogStatus: 'archived',
      archivedAt: new Date().toISOString(),
      archiveReason: input.reason?.trim() || 'Archivo administrativo',
    };

    const envelope = {
      eventName: 'product.archived' as const,
      eventVersion: 'v1' as const,
      occurredAt: new Date().toISOString(),
      payload: { productId: current.id, slug: current.slug, isActive: false },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: current.id }, data: { isActive: false, metadata: metadata as Prisma.InputJsonValue },
        include: { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
      });
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'product.archived',
      entityType: 'product',
      entityId: updated.id,
      beforeData: current,
      afterData: {
        product: updated,
        reason: metadata.archiveReason,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish(event, event.route);

    return ProductEntity.fromState(updated).toAdminResponse();
  }
}
