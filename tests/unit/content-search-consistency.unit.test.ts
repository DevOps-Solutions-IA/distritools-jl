import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UpdateContentBlockUseCase } from 'src/modules/content/application/use-cases/update-content-block.use-case';
import type { VersionedDomainEvent } from 'src/common/events/domain-event.contracts';

const actor = { sub: 'operator', permissions: ['content.manage'] } as never;
function setup(published: boolean, previousPublished = published, fault?: 'outbox' | 'audit') {
  const effects: string[] = [];
  const current = { id: 'content', title: 'new title', placementKey: 'new-placement', isPublished: published, body: { text: 'new body' }, priority: 4 };
  const transaction = { contentBlock: { update: async () => { effects.push('source'); return current; } } };
  const repository = {
    findById: async () => ({ ...current, title: 'old title', isPublished: previousPublished }),
    update: async () => { effects.push('nontransactional-source'); return current; },
  };
  let captured: VersionedDomainEvent | null = null;
  let publishedEvent: unknown;
  const outbox = { captureHeld: async (tx: unknown, input: VersionedDomainEvent) => {
    assert.equal(tx, transaction);
    effects.push('outbox');
    if (fault === 'outbox') throw new Error('synthetic outbox failure');
    captured = { ...input, eventId: 'stable-event-id' };
    return { ...captured, route: 'legacy_hold' };
  } };
  const audit = { write: async (_entry: unknown, tx: unknown) => {
    assert.equal(tx, transaction);
    effects.push('audit');
    if (fault === 'audit') throw new Error('synthetic audit failure');
  } };
  const publisher = { publish: async (event: unknown, route: unknown) => {
    assert.equal(route, 'legacy_hold');
    publishedEvent = event;
    effects.push('publish');
  } };
  const prisma = { $transaction: async (effect: (tx: unknown) => Promise<unknown>) => {
    const result = await effect(transaction); effects.push('commit'); return result;
  } };
  const useCase = new UpdateContentBlockUseCase(repository as never, audit as never, prisma as never, outbox as never, publisher as never);
  return { useCase, effects, captured: () => captured, publishedEvent: () => publishedEvent };
}

describe('EX-07.3 published content edits capture search projection intent', () => {
  it('captures current edited state and publishes the same held identity after commit', async () => {
    const fixture = setup(true);
    await fixture.useCase.execute(actor, 'content', { title: 'new title', placementKey: 'new-placement', body: { text: 'new body' }, priority: 4 });
    assert.deepEqual(fixture.effects, ['source', 'outbox', 'audit', 'commit', 'publish']);
    assert.equal(fixture.captured()?.eventName, 'content.published');
    assert.deepEqual(fixture.captured()?.payload, { contentId: 'content', title: 'new title', placementKey: 'new-placement' });
    assert.equal((fixture.publishedEvent() as VersionedDomainEvent).eventId, 'stable-event-id');
  });
  it('uses transaction-current publication when publication wins after the initial read', async () => {
    const fixture = setup(true, false);
    await fixture.useCase.execute(actor, 'content', { title: 'new title' });
    assert.equal(fixture.captured()?.eventName, 'content.published');
  });
  it('does not publish an edit that is currently unpublished', async () => {
    const fixture = setup(false, true);
    await fixture.useCase.execute(actor, 'content', { title: 'new title' });
    assert.equal(fixture.captured(), null);
    assert.deepEqual(fixture.effects, ['source', 'audit', 'commit']);
  });
  for (const fault of ['outbox', 'audit'] as const) {
    it(`does not commit or dispatch if ${fault} fails`, async () => {
      const fixture = setup(true, true, fault);
      await assert.rejects(fixture.useCase.execute(actor, 'content', { title: 'new title' }), new RegExp(`synthetic ${fault} failure`));
      assert.equal(fixture.effects.includes('commit'), false);
      assert.equal(fixture.publishedEvent(), undefined);
    });
  }
});
