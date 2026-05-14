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

export interface UpdateCategoryTreeInput {
  actor: CurrentUser;
  categoryId: string;
  parentId?: string | null;
  sortOrder: number;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UpdateCategoryTreeUseCase {
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

  async execute(input: UpdateCategoryTreeInput) {
    assertHasPermissions(input.actor.permissions, ['categories.write']);

    const current = this.categoryPolicyService.ensureExists(
      await this.categoryRepository.findById(input.categoryId),
    );

    this.categoryPolicyService.ensureValidSortOrder(input.sortOrder);

    let parentId = input.parentId ?? null;
    if (parentId) {
      let cursor = this.categoryPolicyService.ensureExists(
        await this.categoryRepository.findById(parentId),
      );
      this.categoryPolicyService.ensureValidParent(current.id, cursor);

      const ancestry = [cursor];
      while (cursor.parentId) {
        cursor = this.categoryPolicyService.ensureExists(
          await this.categoryRepository.findById(cursor.parentId),
        );
        ancestry.push(cursor);
      }

      this.categoryPolicyService.ensureNoParentCycle(current.id, ancestry);
    }

    const updated = await this.categoryRepository.update({
      id: current.id,
      parentId,
      sortOrder: input.sortOrder,
    });

    await this.auditRepository.write({
      actorUserId: input.actor.sub,
      action: 'category.tree_updated',
      entityType: 'category',
      entityId: updated.id,
      beforeData: current,
      afterData: updated,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.domainEventPublisher.publish({
      eventName: 'category.tree_updated',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: {
        categoryId: updated.id,
        parentId: updated.parentId,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
      },
    });

    return CategoryEntity.fromState(updated).toAdminResponse();
  }
}
