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
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
    @Inject(ProductPolicyService)
    private readonly productPolicyService: ProductPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: SetProductStatusInput) {
    assertHasPermissions(input.actor.permissions, ['products.manage']);

    const current = this.productPolicyService.ensureExists(
      await this.productRepository.findById(input.productId),
    );

    const updated = await this.productRepository.update({
      id: current.id,
      isActive: input.isActive,
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

    await this.domainEventPublisher.publish({
      eventName: 'product.status_changed',
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
