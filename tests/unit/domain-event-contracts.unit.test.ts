import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAIN_EVENT_CONTRACTS,
  DomainEventContractError,
  validateDomainEvent,
} from 'src/common/events/domain-event.contracts';
import {
  NOTIFICATION_DOMAIN_EVENT_NAMES,
} from 'src/modules/notifications/infrastructure/queue/notifications-event.subscriber';
import {
  SEARCH_DOMAIN_EVENT_NAMES,
} from 'src/modules/search/infrastructure/jobs/search-event.subscriber';

const fixtures: Record<string, Record<string, unknown>> = {
  'order.created': {
    orderId: 'order-1', orderNumber: 'ORD-1', trackingCode: 'TRK-1', status: 'pending',
    totals: { subtotal: '1', discountTotal: '0', taxTotal: '0', shippingTotal: '0', grandTotal: '1' },
    customerEmail: 'customer@example.com', customerPhone: '3111234567',
    items: [{ sku: 'SKU-1', name: 'Item', quantity: 1, unitPrice: '1', lineTotal: '1' }],
  },
  'order.cancelled': { orderId: 'order-1', orderNumber: 'ORD-1', status: 'cancelled', customerEmail: null, customerPhone: null },
  'checkout.guest_order_created': { orderId: 'order-1', orderNumber: 'ORD-1', status: 'pending', total: '1' },
  'payment.intent_created': { paymentId: 'pay-1', orderId: 'order-1', gateway: 'manual', gatewayReference: null, status: 'pending' },
  'payment.approved': { paymentId: 'pay-1', orderId: 'order-1', orderNumber: 'ORD-1', status: 'approved', gatewayReference: null, customerEmail: null, customerPhone: null },
  'payment.rejected': { paymentId: 'pay-1', orderId: 'order-1', orderNumber: 'ORD-1', status: 'rejected', gatewayReference: null, customerEmail: null, customerPhone: null },
  'payment.expired': { paymentId: 'pay-1', orderId: 'order-1', orderNumber: 'ORD-1', status: 'expired', gatewayReference: null, customerEmail: null, customerPhone: null },
  'order.paid': { orderId: 'order-1', orderNumber: 'ORD-1', customerEmail: null, customerPhone: null },
  'product.created': { productId: 'product-1', slug: 'item', isActive: true },
  'product.updated': { productId: 'product-1', slug: 'item', isActive: true },
  'product.status_changed': { productId: 'product-1', slug: 'item', isActive: true },
  'product.archived': { productId: 'product-1', slug: 'item', isActive: false },
  'brand.created': { brandId: 'brand-1', slug: 'brand', isActive: true },
  'brand.updated': { brandId: 'brand-1', slug: 'brand', isActive: true },
  'brand.status_changed': { brandId: 'brand-1', slug: 'brand', isActive: true },
  'category.created': { categoryId: 'category-1', parentId: null, slug: 'category', isActive: true },
  'category.updated': { categoryId: 'category-1', parentId: null, slug: 'category', isActive: true },
  'category.tree_updated': { categoryId: 'category-1', parentId: null, sortOrder: 0, isActive: true },
  'variant.created': { variantId: 'variant-1', productId: null, sku: null, isActive: true },
  'variant.updated': { variantId: 'variant-1', productId: null, sku: null, isActive: true },
  'variant.status_changed': { variantId: 'variant-1', productId: null, sku: null, isActive: true },
  'content.published': { contentId: 'content-1', placementKey: 'home', title: 'Title' },
  'content.unpublished': { contentId: 'content-1', placementKey: 'home', title: 'Title' },
  'promotion.activated': { promotionId: 'promotion-1', slug: 'promotion' },
  'promotion.deactivated': { promotionId: 'promotion-1', slug: 'promotion' },
  'shipment.quote_created': { orderId: 'order-1', shipmentId: 'shipment-1', orderNumber: 'ORD-1', candidates: [{
    carrier: 'tcc', carrierLabel: 'TCC', success: true, message: null, quotedAmount: '1000',
    cashOnDeliveryAmount: null, internalCommission: null, surcharge: null, insuranceAmount: null,
    estimatedDays: 2, estimatedDeliveryDate: null, serviceId: '1', totalComparable: 1000,
  }] },
  'shipment.carrier_selected': { orderId: 'order-1', shipmentId: 'shipment-1', orderNumber: 'ORD-1', selectedCarrier: 'tcc' },
  'shipment.guide_created': { orderId: 'order-1', shipmentId: 'shipment-1', orderNumber: 'ORD-1', guideNumber: 'G-1', carrier: 'tcc' },
  'shipment.auto_shipping_failed': { orderId: 'order-1', shipmentId: 'shipment-1', reason: 'quote_failed' },
};

const event = (eventName: string, payload: Record<string, unknown>) => ({
  eventName,
  eventVersion: 'v1',
  occurredAt: '2026-10-06T12:00:00.000Z',
  payload,
});

describe('domain event contracts', () => {
  it('registers every source-discovered producer exactly once and marks the producer gap', () => {
    assert.deepEqual(Object.keys(fixtures).sort(), Object.keys(DOMAIN_EVENT_CONTRACTS).filter((name) =>
      DOMAIN_EVENT_CONTRACTS[name as keyof typeof DOMAIN_EVENT_CONTRACTS].publishable,
    ).sort());
    assert.equal(DOMAIN_EVENT_CONTRACTS['inventory.low_stock_detected'].producerStatus, 'missing');
    assert.equal(DOMAIN_EVENT_CONTRACTS['inventory.low_stock_detected'].publishable, false);
  });

  it('validates one captured v1 payload for every producer contract', () => {
    for (const [eventName, payload] of Object.entries(fixtures)) {
      assert.equal(validateDomainEvent(event(eventName, payload)).eventName, eventName);
    }
  });

  it('rejects a missing required field and a wrong field type', () => {
    assert.throws(() => validateDomainEvent(event('brand.created', { slug: 'brand', isActive: true })), DomainEventContractError);
    assert.throws(() => validateDomainEvent(event('brand.created', { brandId: 'brand-1', slug: 'brand', isActive: 'yes' })), DomainEventContractError);
    assert.throws(() => validateDomainEvent(event('shipment.quote_created', {
      orderId: 'order-1', shipmentId: 'shipment-1', orderNumber: 'ORD-1', candidates: [{ carrier: 'tcc', quotedAmount: '1000', estimatedDays: null, totalComparable: '1000' }],
    })), DomainEventContractError);
  });

  it('rejects unknown events, unsupported versions, and malformed envelopes', () => {
    assert.throws(() => validateDomainEvent(event('unknown.event', {})), (error: unknown) => error instanceof DomainEventContractError && error.code === 'UNKNOWN_EVENT');
    assert.throws(() => validateDomainEvent({ ...event('brand.created', fixtures['brand.created']), eventVersion: 'v2' }), (error: unknown) => error instanceof DomainEventContractError && error.code === 'UNSUPPORTED_VERSION');
    assert.throws(() => validateDomainEvent({ ...event('brand.created', fixtures['brand.created']), occurredAt: 'yesterday' }), DomainEventContractError);
    assert.throws(() => validateDomainEvent(event('inventory.low_stock_detected', {})), (error: unknown) => error instanceof DomainEventContractError && error.code === 'EVENT_NOT_PUBLISHABLE');
  });

  it('keeps in-memory subscriber ownership aligned with the discovered matrix', () => {
    const subscribers = new Map<string, string[]>([
      ['notifications', NOTIFICATION_DOMAIN_EVENT_NAMES],
      ['search', SEARCH_DOMAIN_EVENT_NAMES],
    ]);
    for (const [consumer, eventNames] of subscribers) {
      for (const eventName of eventNames) {
        assert.ok(DOMAIN_EVENT_CONTRACTS[eventName as keyof typeof DOMAIN_EVENT_CONTRACTS].inMemoryConsumers.includes(consumer as never));
      }
    }
    for (const [eventName, contract] of Object.entries(DOMAIN_EVENT_CONTRACTS)) {
      assert.equal(contract.workerRoute, false, `${eventName} must not be implicitly routed to BullMQ`);
      for (const consumer of contract.inMemoryConsumers) {
        assert.ok(subscribers.get(consumer)?.includes(eventName), `${eventName} declares an absent ${consumer} subscriber`);
      }
    }
  });
});
