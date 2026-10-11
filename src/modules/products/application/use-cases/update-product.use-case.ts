import { ProductImageApprovalService } from 'src/modules/products/domain/services/product-image-approval.service';
import { Prisma } from '@prisma/client';
import { DOMAIN_EVENT_OUTBOX_REPOSITORY, DomainEventOutboxRepository } from 'src/common/events/domain-event-outbox.port';
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
import { ProductEntity } from 'src/modules/products/domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from 'src/modules/products/domain/repositories/product.repository';
import { ProductPolicyService } from 'src/modules/products/domain/services/product-policy.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export interface UpdateProductInput {
  actor: CurrentUser;
  productId: string;
  brandId?: string | null;
  categoryId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateProductUseCase {
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

  async execute(input: UpdateProductInput) {
    assertHasPermissions(input.actor.permissions, ['products.write']);

    const current = this.productPolicyService.ensureExists(
      await this.productRepository.findById(input.productId),
    );

    const slug =
      input.slug !== undefined
        ? this.productPolicyService.normalizeSlug(input.slug)
        : current.slug;

    if (slug !== current.slug) {
      this.productPolicyService.ensureSlugAvailable(
        await this.productRepository.findBySlug(slug),
        current.id,
      );
    }

    const nextBrandId =
      input.brandId !== undefined ? input.brandId : current.brandId;
    const nextCategoryId =
      input.categoryId !== undefined ? input.categoryId : current.categoryId;

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

    if (nextBrandId) {
      brand = await this.prisma.brand.findUnique({
        where: { id: nextBrandId },
        select: { id: true, slug: true, metadata: true },
      });

      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    if (nextCategoryId) {
      category = await this.prisma.category.findUnique({
        where: { id: nextCategoryId },
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

    const updateData = {
      id: current.id,
      brandId: nextBrandId,
      categoryId: nextCategoryId,
      name:
        input.name !== undefined
          ? this.productPolicyService.normalizeName(input.name)
          : current.name,
      slug,
      description:
        input.description !== undefined ? input.description?.trim() || null : current.description,
      metadata:
        input.metadata !== undefined
          ? input.metadata
          : (current.metadata as Prisma.InputJsonValue | null),
      isActive:
        input.isActive !== undefined
          ? input.isActive
          : current.isActive,
    };
    const envelope = {
      eventName: 'product.updated' as const,
      eventVersion: 'v1' as const,
      occurredAt: new Date().toISOString(),
      payload: { productId: current.id, slug: updateData.slug, isActive: updateData.isActive },
    };
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id::text = ${input.productId} FOR UPDATE`;
      const locked = await tx.product.findUnique({ where: { id: input.productId } });
      if (!locked) throw new NotFoundException('Product not found');
      const { id, ...data } = updateData;
      data.metadata = input.metadata === undefined ? locked.metadata as Prisma.InputJsonValue | null : this.media.prepare(input.metadata, locked.metadata);
      const updated = await tx.product.update({
        where: { id },
        data: { ...data, updatedAt: new Date(Math.max(Date.now(), locked.updatedAt.getTime() + 1)), metadata: data.metadata === null ? Prisma.JsonNull : data.metadata },
        include: { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
      });
      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'product.updated',
        entityType: 'product',
        entityId: updated.id,
        beforeData: locked,
        afterData: updated,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);
      const event = await this.outbox.captureHeld(tx as PrismaTransactionClient, envelope);
      return { updated, event };
    });


    await this.domainEventPublisher.publish(event, event.route);

    return ProductEntity.fromState(updated).toAdminResponse();
  }
}
