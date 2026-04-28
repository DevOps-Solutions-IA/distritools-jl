import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CategoryPolicyService } from 'src/modules/categories/domain/services/category-policy.service';

describe('CategoryPolicyService', async () => {
  const service = new CategoryPolicyService();

  await it('detecta ciclos en el árbol de categorías', () => {
    assert.throws(
      () =>
        service.ensureNoParentCycle('category-root', [
          {
            id: 'category-child',
            parentId: 'category-root',
            name: 'Child',
            slug: 'child',
            description: null,
            isActive: true,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'category-root',
            parentId: null,
            name: 'Root',
            slug: 'root',
            description: null,
            isActive: true,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      /cycle detected/i,
    );
  });
});
