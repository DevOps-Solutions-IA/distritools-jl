import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ContentPublicationService } from 'src/modules/content/domain/services/content-publication.service';
import { ContentBlockEntity } from 'src/modules/content/domain/entities/content-block.entity';

describe('ContentPublicationService', async () => {
  const service = new ContentPublicationService();

  await it('solo expone contenido publicado y dentro de ventana', () => {
    const now = new Date('2026-04-24T12:00:00.000Z');
    const content = [
      ContentBlockEntity.fromState({
        id: 'visible',
        title: 'Visible',
        slug: 'visible',
        type: 'hero',
        placementKey: 'home.hero',
        body: {},
        isPublished: true,
        startsAt: new Date('2026-04-24T00:00:00.000Z'),
        endsAt: new Date('2026-04-25T00:00:00.000Z'),
        priority: 100,
        createdAt: now,
        updatedAt: now,
      }),
      ContentBlockEntity.fromState({
        id: 'hidden',
        title: 'Hidden',
        slug: 'hidden',
        type: 'hero',
        placementKey: 'home.hero',
        body: {},
        isPublished: false,
        startsAt: null,
        endsAt: null,
        priority: 200,
        createdAt: now,
        updatedAt: now,
      }),
    ];

    const visible = service.filterVisible(content, now);

    assert.deepEqual(visible.map((entry) => entry.toResponse().id), ['visible']);
  });
});
