import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { SearchController } from 'src/modules/search/infrastructure/http/controllers/search.controller';
import type { AuditLogInput } from 'src/modules/auth/domain/repositories/audit.repository';

const actor = { sub: 'operator', email: 'operator@example.test', permissions: ['search.reindex'] } as never;
function setup(fault?: 'requested' | 'completed' | 'projection') {
  const actions: AuditLogInput[] = [];
  let effects = 0;
  const indexer = { execute: async () => {
    effects += 1;
    if (fault === 'projection') throw new Error('synthetic DB failure');
    return { reindexed: 2 };
  } };
  const audit = { write: async (entry: AuditLogInput) => {
    actions.push(entry);
    if (entry.action === `search.reindex_${fault}`) throw new Error('synthetic audit failure');
  } };
  // Exercise the real controller and replace only external persistence boundaries.
  const controller = new SearchController({} as never, {} as never, indexer as never, indexer as never, audit as never);
  return { controller, actions, effects: () => effects };
}

for (const method of ['reindexVariants', 'reindexContent'] as const) {
  describe(`EX-07.3 ${method} audit boundary`, () => {
    it('rejects an actor without search.reindex before projections or audit writes', async () => {
      const fixture = setup();
      await assert.rejects(async () => fixture.controller[method]({ permissions: [] } as never), ForbiddenException);
      assert.equal(fixture.effects(), 0);
      assert.equal(fixture.actions.length, 0);
    });
    it('persists a request and the actual completed count with one operation identity', async () => {
      const fixture = setup();
      assert.deepEqual(await fixture.controller[method](actor, { ids: [] }), { reindexed: 2 });
      assert.deepEqual(fixture.actions.map((entry) => entry.action), ['search.reindex_requested', 'search.reindex_completed']);
      assert.equal(fixture.actions[0].actorUserId, 'operator');
      assert.equal(fixture.actions[0].entityId, fixture.actions[1].entityId);
      assert.equal((fixture.actions[0].afterData as { fullCatalog: boolean }).fullCatalog, true);
      assert.equal((fixture.actions[1].afterData as { reindexed: number }).reindexed, 2);
      assert.equal(JSON.stringify(fixture.actions).includes('operator@example.test'), false);
    });
    it('rejects audit-start failure before touching projections', async () => {
      const fixture = setup('requested');
      await assert.rejects(async () => fixture.controller[method](actor), /synthetic audit failure/);
      assert.equal(fixture.effects(), 0);
    });
    it('does not report success if completion audit fails after recoverable projections', async () => {
      const fixture = setup('completed');
      await assert.rejects(async () => fixture.controller[method](actor), /synthetic audit failure/);
      assert.equal(fixture.effects(), 1);
    });
    it('records failed projection work and propagates failure without persisting error payloads', async () => {
      const fixture = setup('projection');
      await assert.rejects(async () => fixture.controller[method](actor), /synthetic DB failure/);
      assert.deepEqual(fixture.actions.map((entry) => entry.action), ['search.reindex_requested', 'search.reindex_failed']);
      assert.equal(JSON.stringify(fixture.actions).includes('synthetic DB failure'), false);
    });
  });
}

it('reindex scope remains distinguishable after the real audit sanitizer', async () => {
  const { PrismaAuditRepository } = await import('src/modules/auth/infrastructure/repositories/prisma-audit.repository');
  const persisted: { afterData: { projectionKind: string } }[] = [];
  const audit = new PrismaAuditRepository({ auditLog: {
    create: async ({ data }: { data: typeof persisted[number] }) => { persisted.push(data); },
  } } as never, { get: () => undefined } as never);
  const indexer = { execute: async () => ({ reindexed: 0 }) };
  const controller = new SearchController({} as never, {} as never, indexer as never, indexer as never, audit);
  await controller.reindexVariants(actor);
  await controller.reindexContent(actor);
  assert.deepEqual(persisted.map((row) => row.afterData.projectionKind), ['variant', 'variant', 'content', 'content']);
});
