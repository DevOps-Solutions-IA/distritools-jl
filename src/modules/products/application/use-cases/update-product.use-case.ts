import { Prisma } from '@prisma/client';
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

export interface UpdateProductInput {
  actor: CurrentUser;
  productId: string;
  brandId?: string | null;
  categoryId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateProductUseCase {
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
  ) {}

  async execute(input: UpdateProductInput) {
    assertHasPermissions(input.actor.permissions, ['products.manage']);

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

    const updated = await this.productRepository.update({
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
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'product.updated',
      entityType: 'product',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'product.updated',
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
