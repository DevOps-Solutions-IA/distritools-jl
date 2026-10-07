import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { DOMAIN_EVENT_CONTRACTS } from 'src/common/events/domain-event.contracts';
import { buildDomainEventDispositionMatrix, resolveDomainEventRoute } from 'src/infra/events/domain-event-routing.policy';

const originalEnvironment = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  EX045_TEST_DURABLE_ROUTING: process.env.EX045_TEST_DURABLE_ROUTING,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('persisted domain-event routing policy', () => {
  it('defaults to legacy_hold outside isolated test even if durable was requested', () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';

    assert.deepEqual(resolveDomainEventRoute('order.cancelled', ['notifications.v1']), {
      route: 'legacy_hold', reason: 'DEFAULT_LEGACY_HOLD', policyVersion: 'ex045.v1',
    });
  });

  it('defaults to legacy_hold in test when the isolated opt-in is absent', () => {
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    delete process.env.EX045_TEST_DURABLE_ROUTING;

    assert.equal(resolveDomainEventRoute('order.cancelled', ['notifications.v1']).route, 'legacy_hold');
  });

  it('selects durable only for an isolated test event with all supported consumers registered', () => {
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';

    assert.deepEqual(resolveDomainEventRoute('order.cancelled', ['notifications.v1']), {
      route: 'durable', reason: 'TEST_ONLY_DURABLE', policyVersion: 'ex045.v1',
    });
  });

  it('keeps consumer gaps and no-consumer contracts out of durable routing', () => {
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';

    assert.equal(resolveDomainEventRoute('order.paid', ['notifications.v1']).route, 'legacy_hold');
    assert.equal(resolveDomainEventRoute('order.paid', ['notifications.v1']).reason, 'REQUIRED_CONSUMER_GAP');
    assert.equal(resolveDomainEventRoute('payment.intent_created', []).reason, 'NO_REQUIRED_CONSUMERS');
  });

  it('does not route durable if a declared handler identity is absent', () => {
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    process.env.EX045_TEST_DURABLE_ROUTING = 'true';

    assert.deepEqual(resolveDomainEventRoute('order.cancelled', []), {
      route: 'legacy_hold', reason: 'REGISTERED_CONSUMER_MISSING', policyVersion: 'ex045.v1',
    });
  });

  it('derives a disposition for every contract and leaves known gaps explicit', () => {
    const registry = Object.fromEntries([
      'order.created', 'order.cancelled', 'payment.approved', 'payment.rejected', 'payment.expired',
      'product.created', 'product.updated', 'product.status_changed', 'brand.created', 'brand.updated',
      'brand.status_changed', 'category.created', 'category.updated', 'category.tree_updated',
      'variant.created', 'variant.updated', 'variant.status_changed', 'content.published', 'content.unpublished',
      'shipment.quote_created', 'shipment.carrier_selected', 'shipment.guide_created', 'shipment.auto_shipping_failed',
    ].map((eventName) => [eventName, eventName.startsWith('order.') || eventName.startsWith('payment.') || eventName.startsWith('shipment.')
      ? ['notifications.v1'] : ['search-projection.v1']]));
    const matrix = buildDomainEventDispositionMatrix(registry as never);
    const orderPaid = matrix.find((row) => row.eventName === 'order.paid')!;
    const lowStock = matrix.find((row) => row.eventName === 'inventory.low_stock_detected')!;
    const auditOnly = matrix.find((row) => row.eventName === 'payment.intent_created')!;

    assert.equal(matrix.length, Object.keys(DOMAIN_EVENT_CONTRACTS).length);
    assert.equal(orderPaid.eligible, false);
    assert.equal(orderPaid.consumers[0]?.disposition, 'BLOCKED_GAP');
    assert.equal(lowStock.eligible, false);
    assert.equal(lowStock.producerStatus, 'missing');
    assert.equal(auditOnly.consumers[0]?.disposition, 'NOT_APPLICABLE');
  });
});
