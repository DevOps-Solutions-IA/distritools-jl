export type DomainEventName =
  | 'order.created'
  | 'order.cancelled'
  | 'checkout.guest_order_created'
  | 'payment.intent_created'
  | 'payment.approved'
  | 'payment.rejected'
  | 'payment.expired'
  | 'order.paid'
  | 'product.created'
  | 'product.updated'
  | 'product.status_changed'
  | 'product.archived'
  | 'brand.created'
  | 'brand.updated'
  | 'brand.status_changed'
  | 'category.created'
  | 'category.updated'
  | 'category.tree_updated'
  | 'variant.created'
  | 'variant.updated'
  | 'variant.status_changed'
  | 'content.published'
  | 'content.unpublished'
  | 'promotion.activated'
  | 'promotion.deactivated'
  | 'shipment.quote_created'
  | 'shipment.carrier_selected'
  | 'shipment.guide_created'
  | 'shipment.auto_shipping_failed'
  | 'inventory.low_stock_detected';

type OrderTotals = {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
};

type OrderItemSnapshot = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

type ShipmentCandidateSnapshot = {
  carrier: string;
  carrierLabel?: string | null;
  success?: boolean;
  message?: string | null;
  quotedAmount: string | null;
  cashOnDeliveryAmount?: string | null;
  internalCommission?: string | null;
  surcharge?: string | null;
  insuranceAmount?: string | null;
  estimatedDays: number | null;
  estimatedDeliveryDate?: Date | string | null;
  serviceId?: string | null;
  totalComparable: number;
};

type PaymentEventPayload = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  gatewayReference: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

export interface DomainEventPayloadMap {
  'order.created': {
    orderId: string;
    orderNumber: string;
    trackingCode: string;
    status: string;
    totals: OrderTotals;
    customerEmail: string | null;
    customerPhone: string | null;
    items: OrderItemSnapshot[];
  };
  'order.cancelled': {
    orderId: string;
    orderNumber: string;
    status: string;
    customerEmail: string | null;
    customerPhone: string | null;
  };
  'checkout.guest_order_created': { orderId: string; orderNumber: string; status: string; total: string };
  'payment.intent_created': {
    paymentId: string;
    orderId: string;
    gateway: string;
    gatewayReference: string | null;
    status: string;
  };
  'payment.approved': PaymentEventPayload;
  'payment.rejected': PaymentEventPayload;
  'payment.expired': PaymentEventPayload;
  'order.paid': { orderId: string; orderNumber: string; customerEmail: string | null; customerPhone: string | null };
  'product.created': { productId: string; slug: string; isActive: boolean };
  'product.updated': { productId: string; slug: string; isActive: boolean };
  'product.status_changed': { productId: string; slug: string; isActive: boolean };
  'product.archived': { productId: string; slug: string; isActive: boolean };
  'brand.created': { brandId: string; slug: string; isActive: boolean };
  'brand.updated': { brandId: string; slug: string; isActive: boolean };
  'brand.status_changed': { brandId: string; slug: string; isActive: boolean };
  'category.created': { categoryId: string; parentId: string | null; slug: string; isActive: boolean };
  'category.updated': { categoryId: string; parentId: string | null; slug: string; isActive: boolean };
  'category.tree_updated': { categoryId: string; parentId: string | null; sortOrder: number; isActive: boolean };
  'variant.created': { variantId: string; productId: string | null; sku: string | null; isActive: boolean };
  'variant.updated': { variantId: string; productId: string | null; sku: string | null; isActive: boolean };
  'variant.status_changed': { variantId: string; productId: string | null; sku: string | null; isActive: boolean };
  'content.published': { contentId: string; placementKey: string; title: string };
  'content.unpublished': { contentId: string; placementKey: string; title: string };
  'promotion.activated': { promotionId: string; slug: string };
  'promotion.deactivated': { promotionId: string; slug: string };
  'shipment.quote_created': { orderId: string; shipmentId: string; orderNumber: string; candidates: ShipmentCandidateSnapshot[] };
  'shipment.carrier_selected': { orderId: string; shipmentId: string; orderNumber: string; selectedCarrier: string };
  'shipment.guide_created': { orderId: string; shipmentId: string; orderNumber: string; guideNumber: string | null; carrier: string };
  'shipment.auto_shipping_failed': { orderId: string; shipmentId: string; reason: string };
}

export type PublishableDomainEventName = keyof DomainEventPayloadMap;

export type VersionedDomainEvent = {
  [TName in PublishableDomainEventName]: {
    eventId?: string;
    eventName: TName;
    eventVersion: 'v1';
    payload: DomainEventPayloadMap[TName];
    occurredAt: string;
    correlationId?: string;
  };
}[PublishableDomainEventName];

export type InMemoryConsumer = 'notifications' | 'search';
export type EventDisposition =
  | 'in_memory_consumed'
  | 'known_consumer_gap'
  | 'no_consumer'
  | 'producer_missing';

type FieldRule =
  | 'unknown'
  | 'string'
  | 'nullableString'
  | 'boolean'
  | 'number'
  | 'nullableNumber'
  | 'dateOrNull'
  | { optional: FieldRule }
  | { object: Record<string, FieldRule> }
  | { array: FieldRule };

type EventContract = {
  owner: string | null;
  producerStatus: 'present' | 'missing';
  publishable: boolean;
  inMemoryConsumers: readonly InMemoryConsumer[];
  workerRoute: false;
  disposition: EventDisposition;
  fields: Record<string, FieldRule> | null;
};

const strings = (...fields: string[]): Record<string, FieldRule> =>
  Object.fromEntries(fields.map((field) => [field, 'string']));
const statusEntity = (idField: string, extra: Record<string, FieldRule> = {}) => ({
  ...strings(idField, 'slug'),
  isActive: 'boolean' as const,
  ...extra,
});
const category = (tree = false) => ({
  categoryId: 'string' as const,
  parentId: 'nullableString' as const,
  ...(tree ? { sortOrder: 'number' as const } : { slug: 'string' as const }),
  isActive: 'boolean' as const,
});
const paymentResult = {
  ...strings('paymentId', 'orderId', 'orderNumber', 'status'),
  gatewayReference: 'nullableString' as const,
  customerEmail: 'nullableString' as const,
  customerPhone: 'nullableString' as const,
};

export const DOMAIN_EVENT_CONTRACTS = Object.freeze({
  'order.created': {
    owner: 'orders.create-order', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed',
    fields: {
      ...strings('orderId', 'orderNumber', 'trackingCode', 'status'),
      totals: { object: { subtotal: 'string', discountTotal: 'string', taxTotal: 'string', shippingTotal: 'string', grandTotal: 'string' } },
      customerEmail: 'nullableString', customerPhone: 'nullableString',
      items: { array: { object: { ...strings('sku', 'name'), quantity: 'number', unitPrice: 'string', lineTotal: 'string' } } },
    },
  },
  'order.cancelled': {
    owner: 'orders.cancel-order', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed',
    fields: { ...strings('orderId', 'orderNumber', 'status'), customerEmail: 'nullableString', customerPhone: 'nullableString' },
  },
  'checkout.guest_order_created': {
    owner: 'orders.create-guest-checkout-order', producerStatus: 'present', publishable: true,
    inMemoryConsumers: [], workerRoute: false, disposition: 'no_consumer',
    fields: { ...strings('orderId', 'orderNumber', 'status'), total: 'string' },
  },
  'payment.intent_created': {
    owner: 'payments.create-payment-intent', producerStatus: 'present', publishable: true,
    inMemoryConsumers: [], workerRoute: false, disposition: 'no_consumer',
    fields: { ...strings('paymentId', 'orderId', 'gateway', 'status'), gatewayReference: 'nullableString' },
  },
  'payment.approved': {
    owner: 'payments.process-payment-webhook', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed', fields: paymentResult,
  },
  'payment.rejected': {
    owner: 'payments.process-payment-webhook', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed', fields: paymentResult,
  },
  'payment.expired': {
    owner: 'payments.process-payment-webhook', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed', fields: paymentResult,
  },
  'order.paid': {
    owner: 'payments.process-payment-webhook', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'known_consumer_gap',
    fields: { ...strings('orderId', 'orderNumber'), customerEmail: 'nullableString', customerPhone: 'nullableString' },
  },
  'product.created': {
    owner: 'products.create-product', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: statusEntity('productId'),
  },
  'product.updated': {
    owner: 'products.update-product', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: statusEntity('productId'),
  },
  'product.status_changed': {
    owner: 'products.set-product-status', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: statusEntity('productId'),
  },
  'product.archived': {
    owner: 'products.archive-product', producerStatus: 'present', publishable: true,
    inMemoryConsumers: [], workerRoute: false, disposition: 'no_consumer', fields: statusEntity('productId'),
  },
  'brand.created': {
    owner: 'brands.create-brand', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: statusEntity('brandId'),
  },
  'brand.updated': {
    owner: 'brands.update-brand', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: statusEntity('brandId'),
  },
  'brand.status_changed': {
    owner: 'brands.set-brand-active', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: statusEntity('brandId'),
  },
  'category.created': {
    owner: 'categories.create-category', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: category(),
  },
  'category.updated': {
    owner: 'categories.update-category', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: category(),
  },
  'category.tree_updated': {
    owner: 'categories.update-category-tree', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: category(true),
  },
  'variant.created': {
    owner: 'variants.create-variant', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: { variantId: 'string', productId: 'nullableString', sku: 'nullableString', isActive: 'boolean' },
  },
  'variant.updated': {
    owner: 'variants.update-variant', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: { variantId: 'string', productId: 'nullableString', sku: 'nullableString', isActive: 'boolean' },
  },
  'variant.status_changed': {
    owner: 'variants.set-variant-status', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: { variantId: 'string', productId: 'nullableString', sku: 'nullableString', isActive: 'boolean' },
  },
  'content.published': {
    owner: 'content.create-content-block|set-content-published|update-content-block', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: strings('contentId', 'placementKey', 'title'),
  },
  'content.unpublished': {
    owner: 'content.set-content-published', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['search'], workerRoute: false, disposition: 'in_memory_consumed', fields: strings('contentId', 'placementKey', 'title'),
  },
  'promotion.activated': {
    owner: 'promotions.create-promotion|set-promotion-active', producerStatus: 'present', publishable: true,
    inMemoryConsumers: [], workerRoute: false, disposition: 'no_consumer', fields: strings('promotionId', 'slug'),
  },
  'promotion.deactivated': {
    owner: 'promotions.set-promotion-active', producerStatus: 'present', publishable: true,
    inMemoryConsumers: [], workerRoute: false, disposition: 'no_consumer', fields: strings('promotionId', 'slug'),
  },
  'shipment.quote_created': {
    owner: 'shipping.auto-shipping', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed',
    fields: {
      ...strings('orderId', 'shipmentId', 'orderNumber'),
      candidates: { array: { object: {
        carrier: 'string', carrierLabel: { optional: 'nullableString' }, success: { optional: 'boolean' },
        message: { optional: 'nullableString' }, quotedAmount: 'nullableString',
        cashOnDeliveryAmount: { optional: 'nullableString' }, internalCommission: { optional: 'nullableString' },
        surcharge: { optional: 'nullableString' }, insuranceAmount: { optional: 'nullableString' },
        estimatedDays: 'nullableNumber', estimatedDeliveryDate: { optional: 'dateOrNull' },
        serviceId: { optional: 'nullableString' }, totalComparable: 'number',
      } } },
    },
  },
  'shipment.carrier_selected': {
    owner: 'shipping.auto-shipping', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed',
    fields: strings('orderId', 'shipmentId', 'orderNumber', 'selectedCarrier'),
  },
  'shipment.guide_created': {
    owner: 'shipping.auto-shipping', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed',
    fields: { ...strings('orderId', 'shipmentId', 'orderNumber', 'carrier'), guideNumber: 'nullableString' },
  },
  'shipment.auto_shipping_failed': {
    owner: 'shipping.auto-shipping', producerStatus: 'present', publishable: true,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'in_memory_consumed', fields: strings('orderId', 'shipmentId', 'reason'),
  },
  'inventory.low_stock_detected': {
    owner: null, producerStatus: 'missing', publishable: false,
    inMemoryConsumers: ['notifications'], workerRoute: false, disposition: 'producer_missing', fields: null,
  },
} as const satisfies Record<DomainEventName, EventContract>);

export const DOMAIN_EVENT_NAMES = Object.freeze(Object.keys(DOMAIN_EVENT_CONTRACTS) as DomainEventName[]);

export class DomainEventContractError extends Error {
  constructor(
    readonly code: 'INVALID_ENVELOPE' | 'UNKNOWN_EVENT' | 'UNSUPPORTED_VERSION' | 'EVENT_NOT_PUBLISHABLE' | 'INVALID_PAYLOAD',
    message: string,
  ) {
    super(message);
    this.name = 'DomainEventContractError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateFields(value: unknown, fields: Record<string, FieldRule>, path: string): void {
  if (!isRecord(value)) throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be an object`);
  for (const [key, rule] of Object.entries(fields)) {
    const fieldPath = `${path}.${key}`;
    const optional = typeof rule === 'object' && 'optional' in rule;
    const fieldRule = optional ? rule.optional : rule;
    if (!(key in value)) {
      if (optional) continue;
      throw new DomainEventContractError('INVALID_PAYLOAD', `${fieldPath} is required`);
    }
    const fieldValue = value[key];
    validateField(fieldValue, fieldRule, fieldPath);
  }
}

function validateField(value: unknown, rule: FieldRule, path: string): void {
  if (rule === 'unknown') return;
  if (rule === 'string' && typeof value !== 'string') throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be a string`);
  if (rule === 'nullableString' && value !== null && typeof value !== 'string') throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be a string or null`);
  if (rule === 'boolean' && typeof value !== 'boolean') throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be a boolean`);
  if (rule === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be a finite number`);
  if (rule === 'nullableNumber' && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be a finite number or null`);
  if (rule === 'dateOrNull' && value !== null && !(value instanceof Date) && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) {
    throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be a valid date or null`);
  }
  if (typeof rule === 'object' && 'optional' in rule) validateField(value, rule.optional, path);
  if (typeof rule === 'object' && 'object' in rule) validateFields(value, rule.object, path);
  if (typeof rule === 'object' && 'array' in rule) {
    if (!Array.isArray(value)) throw new DomainEventContractError('INVALID_PAYLOAD', `${path} must be an array`);
    value.forEach((item, index) => {
      const itemRule = rule.array;
      if (typeof itemRule === 'object' && 'object' in itemRule) validateFields(item, itemRule.object, `${path}[${index}]`);
      else validateField(item, itemRule, `${path}[${index}]`);
    });
  }
}

export function validateDomainEvent(
  input: unknown,
  options: { requireEventId?: boolean } = {},
): VersionedDomainEvent {
  if (!isRecord(input)) throw new DomainEventContractError('INVALID_ENVELOPE', 'Event envelope must be an object');
  if (typeof input.eventName !== 'string' || !Object.hasOwn(DOMAIN_EVENT_CONTRACTS, input.eventName)) {
    throw new DomainEventContractError('UNKNOWN_EVENT', 'Event name is not registered');
  }
  const contract = DOMAIN_EVENT_CONTRACTS[input.eventName as DomainEventName];
  if (contract.producerStatus !== 'present' || !contract.publishable || !contract.fields) {
    throw new DomainEventContractError('EVENT_NOT_PUBLISHABLE', 'Event has no approved producer contract');
  }
  if (input.eventVersion !== 'v1') throw new DomainEventContractError('UNSUPPORTED_VERSION', 'Event version is not supported');
  if (options.requireEventId && (typeof input.eventId !== 'string' || input.eventId.length === 0)) {
    throw new DomainEventContractError('INVALID_ENVELOPE', 'eventId is required');
  }
  if (input.eventId !== undefined && (typeof input.eventId !== 'string' || input.eventId.length === 0)) {
    throw new DomainEventContractError('INVALID_ENVELOPE', 'eventId must be a non-empty string');
  }
  if (typeof input.occurredAt !== 'string' || Number.isNaN(Date.parse(input.occurredAt))) {
    throw new DomainEventContractError('INVALID_ENVELOPE', 'occurredAt must be a valid date string');
  }
  if (input.correlationId !== undefined && typeof input.correlationId !== 'string') {
    throw new DomainEventContractError('INVALID_ENVELOPE', 'correlationId must be a string');
  }
  validateFields(input.payload, contract.fields, 'payload');
  return input as unknown as VersionedDomainEvent;
}
