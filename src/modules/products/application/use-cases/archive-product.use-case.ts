import { Prisma } from '@prisma/client';
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
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
    @Inject(ProductPolicyService)
    private readonly productPolicyService: ProductPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
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

    const updated = await this.productRepository.update({
      id: current.id,
      isActive: false,
      metadata: metadata as Prisma.InputJsonValue,
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

    await this.domainEventPublisher.publish({
      eventName: 'product.archived',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        productId: updated.id,
        slug: updated.slug,
        isActive: updated.isActive,
      },
    });

    return ProductEntity.fromState(updated).toAdminResponse();
  }
}

