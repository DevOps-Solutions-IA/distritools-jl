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
import { CategoryEntity } from 'src/modules/categories/domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from 'src/modules/categories/domain/repositories/category.repository';
import { CategoryPolicyService } from 'src/modules/categories/domain/services/category-policy.service';

export interface UpdateCategoryInput {
  actor: CurrentUser;
  categoryId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
    @Inject(CategoryPolicyService)
    private readonly categoryPolicyService: CategoryPolicyService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: UpdateCategoryInput) {
    assertHasPermissions(input.actor.permissions, ['categories.manage']);

    const current = this.categoryPolicyService.ensureExists(
      await this.categoryRepository.findById(input.categoryId),
    );

    const slug =
      input.slug !== undefined
        ? this.categoryPolicyService.normalizeSlug(input.slug)
        : current.slug;

    if (slug !== current.slug) {
      this.categoryPolicyService.ensureSlugAvailable(
        await this.categoryRepository.findBySlug(slug),
        current.id,
      );
    }

    if (input.sortOrder !== undefined) {
      this.categoryPolicyService.ensureValidSortOrder(input.sortOrder);
    }

    const updated = await this.categoryRepository.update({
      id: current.id,
      name:
        input.name !== undefined
          ? this.categoryPolicyService.normalizeName(input.name)
          : current.name,
      slug,
      description:
        input.description !== undefined ? input.description?.trim() || null : current.description,
      isActive: input.isActive ?? current.isActive,
      sortOrder: input.sortOrder ?? current.sortOrder,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'category.updated',
      entityType: 'category',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'category.updated',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        categoryId: updated.id,
        parentId: updated.parentId,
        slug: updated.slug,
        isActive: updated.isActive,
      },
    });

    return CategoryEntity.fromState(updated).toAdminResponse();
  }
}
