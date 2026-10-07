import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomainEventHandlerRegistry, MissingRequiredDomainEventConsumersError } from 'src/infra/events/domain-event-handler.registry';

const event = {
  eventId: 'event-1', eventName: 'brand.created', eventVersion: 'v1',
  occurredAt: '2026-10-06T12:00:00.000Z',
  payload: { brandId: 'brand-1', slug: 'brand', isActive: true },
} as const;

describe('DomainEventHandlerRegistry', () => {
  it('dispatches only a registered handler exactly once', async () => {
    const registry = new DomainEventHandlerRegistry();
    let calls = 0;
    registry.register('brand.created', 'search-projection.v1', async (received) => {
      calls += 1;
      assert.strictEqual(received, event);
    });

    await registry.dispatch(event);
    assert.equal(calls, 1);
  });

  it('rejects missing handlers with a typed error', async () => {
    await assert.rejects(new DomainEventHandlerRegistry().dispatch(event), MissingRequiredDomainEventConsumersError);
  });

  it('rejects duplicate registration for an event and consumer', () => {
    const registry = new DomainEventHandlerRegistry();
    const handler = async () => undefined;
    registry.register('brand.created', 'search-projection.v1', handler);
    assert.throws(() => registry.register('brand.created', 'search-projection.v1', handler), /already registered/);
  });

  it('does not swallow handler errors', async () => {
    const registry = new DomainEventHandlerRegistry();
    const expected = new Error('retry me');
    registry.register('brand.created', 'search-projection.v1', async () => { throw expected; });
    await assert.rejects(registry.dispatch(event), (error: unknown) => error === expected);
  });
});
