import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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

export interface CreateCategoryInput {
  actor: CurrentUser;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateCategoryUseCase {
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

  async execute(input: CreateCategoryInput) {
    assertHasPermissions(input.actor.permissions, ['categories.manage']);

    const slug = this.categoryPolicyService.normalizeSlug(input.slug);
    this.categoryPolicyService.ensureSlugAvailable(
      await this.categoryRepository.findBySlug(slug),
    );

    if (input.sortOrder !== undefined) {
      this.categoryPolicyService.ensureValidSortOrder(input.sortOrder);
    }

    if (input.parentId) {
      this.categoryPolicyService.ensureExists(
        await this.categoryRepository.findById(input.parentId),
      );
    }

    const category = await this.categoryRepository.create({
      id: uuidv7(),
      parentId: input.parentId ?? null,
      name: this.categoryPolicyService.normalizeName(input.name),
      slug,
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'category.created',
      entityType: 'category',
      entityId: category.id,
      afterData: category,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'category.created',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        categoryId: category.id,
        parentId: category.parentId,
        slug: category.slug,
        isActive: category.isActive,
      },
    });

    return CategoryEntity.fromState(category).toAdminResponse();
  }
}
