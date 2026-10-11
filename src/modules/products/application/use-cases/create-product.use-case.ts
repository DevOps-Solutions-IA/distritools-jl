import { ProductImageApprovalService } from 'src/modules/products/domain/services/product-image-approval.service';
import { Prisma } from '@prisma/client';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
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
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export interface CreateProductInput {
  actor: CurrentUser;
  brandId?: string | null;
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(ProductImageApprovalService)
    private readonly media: ProductImageApprovalService,
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

  async execute(input: CreateProductInput) {
    assertHasPermissions(input.actor.permissions, ['products.write']);

    const slug = this.productPolicyService.normalizeSlug(input.slug);
    this.productPolicyService.ensureSlugAvailable(
      await this.productRepository.findBySlug(slug),
    );

    let brand:
      | {
          id: string;
          slug: string;
          metadata: Prisma.JsonValue | null;
        }
      | null = null;
    let category:
      | {
          id: string;
          slug: string;
        }
      | null = null;

    if (input.brandId) {
      brand = await this.prisma.brand.findUnique({
        where: { id: input.brandId },
        select: { id: true, slug: true, metadata: true },
      });

      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    if (input.categoryId) {
      category = await this.prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true, slug: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    this.productPolicyService.ensureCategoryAllowedForBrand({
      brand,
      category,
    });

    const productData = {
      id: uuidv7(),
      brandId: input.brandId ?? null,
      categoryId: input.categoryId ?? null,
      name: this.productPolicyService.normalizeName(input.name),
      slug,
      description: input.description?.trim() || null,
      metadata: this.media.prepare(input.metadata),
      isActive: input.isActive ?? true,
    };
    const envelope = {
      eventName: 'product.created' as const,
      eventVersion: 'v1' as const,
      occurredAt: new Date().toISOString(),
      payload: {
        productId: productData.id,
        slug: productData.slug,
        isActive: productData.isActive,
      },
    };
    const { product, event } = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          metadata: productData.metadata === null ? Prisma.JsonNull : productData.metadata,
        },
        include: { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
      });
      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'product.created',
        entityType: 'product',
        entityId: product.id,
        afterData: product,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { product, event };
    });


    await this.domainEventPublisher.publish(event, event.route);

    return ProductEntity.fromState(product).toAdminResponse();
  }
}
