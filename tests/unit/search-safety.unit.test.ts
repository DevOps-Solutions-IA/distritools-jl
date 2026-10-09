import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaSearchRepository } from 'src/modules/search/infrastructure/repositories/prisma-search.repository';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';
import { SearchController } from 'src/modules/search/infrastructure/http/controllers/search.controller';
import { SearchRankingService } from 'src/modules/search/domain/services/search-ranking.service';
import { validate } from 'class-validator';
import { ReindexSearchRequestDto } from 'src/modules/search/infrastructure/http/dto/reindex-search.request.dto';
import { randomUUID } from 'node:crypto';

// PostgreSQL is external; assert the actual queries emitted at its adapter boundary.
function queryRepository() {
  const calls: Prisma.SearchDocumentFindManyArgs[] = [];
  return {
    calls,
    repository: new PrismaSearchRepository({ searchDocument: {
      findMany: async (args: Prisma.SearchDocumentFindManyArgs) => { calls.push(args); return []; },
    } } as never),
  };
}

describe('EX-07.3 search query safety', () => {
  for (const method of ['search', 'autocomplete'] as const) {
    it(`${method} rejects a missing or structured query with 400 before querying`, async () => {
      const { repository, calls } = queryRepository();
      for (const value of [undefined, null, ['sku'], { contains: 'sku' }, 1]) {
        await assert.rejects(repository[method](value as never), BadRequestException);
      }
      assert.equal(calls.length, 0);
    });
    it(`${method} enforces finite positive integral result caps before querying`, async () => {
      const { repository, calls } = queryRepository();
      for (const limit of [0, -1, 1.5, NaN, Infinity, 101]) {
        await assert.rejects(method === 'search'
          ? repository.search('sku', { limit }) : repository.autocomplete('sku', limit), BadRequestException);
      }
      assert.equal(calls.length, 0);
    });
    it(`${method} returns no results for whitespace and bounds query length`, async () => {
      const { repository, calls } = queryRepository();
      assert.deepEqual(await repository[method]('   '), []);
      await assert.rejects(repository[method]('x'.repeat(257)), BadRequestException);
      await assert.rejects(repository[method]('sku\u0000'), BadRequestException);
      assert.equal(calls.length, 0);
    });
    it(`${method} uses current variant/product status and content publication windows`, async () => {
      const { repository, calls } = queryRepository();
      await repository[method]('sku');
      const args = calls[0];
      const constraints = args.where?.AND as Prisma.SearchDocumentWhereInput[];
      assert.ok(Array.isArray(constraints));
      const eligible = constraints[0].OR!;
      assert.equal(eligible[0].documentType, 'variant');
      assert.deepEqual(eligible[0].variant, { is: {
        isActive: true, OR: [{ productId: null }, { product: { is: { isActive: true } } }],
      } });
      assert.equal(eligible[1].documentType, 'content');
      const content = eligible[1].contentBlock as { is: Prisma.ContentBlockWhereInput };
      assert.equal(content.is.isPublished, true);
      const starts = content.is.OR!;
      assert.equal(starts[0].startsAt, null);
      assert.ok((starts[1].startsAt as Prisma.DateTimeNullableFilter).lte instanceof Date);
      const ends = (content.is.AND as Prisma.ContentBlockWhereInput[])[0].OR!;
      assert.equal(ends[0].endsAt, null);
      assert.ok((ends[1].endsAt as Prisma.DateTimeNullableFilter).gte instanceof Date);
    });
    it(`${method} limits response columns and breaks database ties with stable identity`, async () => {
      const { repository, calls } = queryRepository();
      await repository[method]("sku' OR 1=1 --");
      assert.deepEqual(calls[0].select, {
        id: true, documentType: true, title: true, subtitle: true, sku: true,
        brandName: true, brandSlug: true, categoryName: true, categorySlug: true,
        placementKey: true, availability: true, priority: true,
        ...(method === 'search' ? { variantId: true } : {}),
      });
      assert.deepEqual(calls[0].orderBy, [
        { priority: 'desc' }, { availability: 'desc' }, { title: 'asc' }, { id: 'asc' },
      ]);
      assert.equal(calls[0].take, method === 'search' ? 20 : 10);
    });
  }
  it('rejects structured or excessively long filters before querying', async () => {
    const { repository, calls } = queryRepository();
    for (const value of [['brand'], { equals: 'brand' }, 'x'.repeat(257)]) {
      await assert.rejects(repository.search('sku', { brandSlug: value as never }), BadRequestException);
      await assert.rejects(repository.search('sku', { categorySlug: value as never }), BadRequestException);
    }
    assert.equal(calls.length, 0);
  });
  it('does not accept numeric coercions of malformed HTTP limits', () => {
    const controller = new SearchController({ execute: () => [] } as never, { execute: () => [] } as never, {} as never, {} as never, {} as never);
    for (const limit of ['', '1e2', '0x10', ' 2', '1.0']) {
      assert.throws(() => controller.search('sku', limit), BadRequestException);
      assert.throws(() => controller.autocomplete('sku', limit), BadRequestException);
    }
  });
  it('uses identity to resolve exact ranking ties regardless of input order', () => {
    const a = { id: 'a', documentType: 'variant' as const, title: 'sku', subtitle: null, sku: 'sku',
      brandName: null, categoryName: null, placementKey: null, availability: 0, priority: 0 };
    const b = { ...a, id: 'b' };
    const ranking = new SearchRankingService();
    assert.deepEqual(ranking.sortResults('sku', [b, a]).map((row) => row.id), ['a', 'b']);
  });
  it('bounds manual ID lists while preserving empty-list full reindex', async () => {
    const empty = Object.assign(new ReindexSearchRequestDto(), { ids: [] });
    assert.equal((await validate(empty)).length, 0);
    const excessive = Object.assign(new ReindexSearchRequestDto(), { ids: Array.from({ length: 1001 }, () => randomUUID()) });
    assert.ok((await validate(excessive)).some((error) => error.constraints?.arrayMaxSize));
  });
});

it('EX-07.3 reindex subtracts committed stock and excludes inactive parent products without loading stock relations', async () => {
  const sources = [
    { id: 'a', sku: 'A', name: 'Active', isActive: true, product: { name: 'Parent', description: null, metadata: null, isActive: true, brand: null, category: null }, inventoryItems: [{ onHandQty: 12, reservedQty: 2, committedQty: 7 }] },
    { id: 'b', sku: 'B', name: 'Inactive parent', isActive: true, product: { name: 'Hidden', description: null, metadata: null, isActive: false, brand: null, category: null }, inventoryItems: [] },
    { id: 'c', sku: 'C', name: 'Standalone', isActive: true, product: null, inventoryItems: [] },
  ];
  const reads: Record<string, unknown>[] = [];
  const transaction = {
    variant: { findMany: async (args: Record<string, unknown>) => { reads.push(args); return args.select ? sources.map(({ id }) => ({ id })) : sources; } },
    inventoryItem: { groupBy: async () => [{ variantId: 'a', _sum: { onHandQty: 12, reservedQty: 2, committedQty: 7 } }] },
  };
  let documents: { id: string; isActive: boolean; availability: number }[] = [];
  const repository = { lockVariantProjection: async () => {}, upsertVariantDocuments: async (rows: typeof documents) => { documents = rows; } };
  const useCase = new ReindexVariantsUseCase({} as never, repository as never);
  assert.deepEqual(await useCase.execute(['a', 'b', 'c'], transaction as never), { reindexed: 3 });
  assert.deepEqual(documents.map(({ id, isActive, availability }) => ({ id, isActive, availability })), [
    { id: 'a', isActive: true, availability: 3 }, { id: 'b', isActive: false, availability: 0 }, { id: 'c', isActive: true, availability: 0 },
  ]);
  assert.equal((reads[1].include as Record<string, unknown>).inventoryItems, undefined);
});

it('EX-07.3 search reads current bounded stock after an inventory-only transition and omits internal variant IDs', async () => {
  const groups: unknown[] = [];
  const repository = new PrismaSearchRepository({
    searchDocument: { findMany: async () => [{
      id: 'projection', documentType: 'variant', variantId: 'variant', title: 'sku', subtitle: null, sku: 'sku',
      brandName: null, brandSlug: null, categoryName: null, categorySlug: null,
      placementKey: null, availability: 10, priority: 10,
    }] },
    inventoryItem: { groupBy: async (args: unknown) => { groups.push(args); return [{ variantId: 'variant', _sum: { onHandQty: 10, reservedQty: 4, committedQty: 6 } }]; } },
  } as never);
  const result = await repository.search('sku');
  assert.equal(result.length, 1);
  assert.equal(result[0].availability, 0);
  assert.equal(result[0].priority, 0);
  assert.equal(Object.hasOwn(result[0], 'variantId'), false);
  assert.deepEqual(groups, [{ by: ['variantId'], where: { variantId: { in: ['variant'] } }, _sum: { onHandQty: true, reservedQty: true, committedQty: true } }]);
});
