'use client';

export type CommerceEventName =
  | 'mini_cart_opened'
  | 'mini_cart_checkout_clicked'
  | 'cart_viewed'
  | 'checkout_started'
  | 'payment_method_selected'
  | 'shipping_quote_requested'
  | 'shipping_quote_failed'
  | 'order_submitted'
  | 'payment_intent_created'
  | 'payment_failed'
  | 'quote_requested'
  | 'checkout_completed';

type CommerceEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

function sanitizeProperties(properties: CommerceEventProperties = {}) {
  const piiKeys = new Set([
    'email',
    'phone',
    'document',
    'address',
    'fullName',
    'recipientName',
  ]);

  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => !piiKeys.has(key)),
  );
}

export function trackCommerceEvent(
  name: CommerceEventName,
  properties?: CommerceEventProperties,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('distritools:commerce-event', {
      detail: {
        name,
        properties: sanitizeProperties(properties),
      },
    }),
  );
}

export function captureCommerceError(
  scope: string,
  error: unknown,
  properties?: CommerceEventProperties,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('distritools:commerce-error', {
      detail: {
        scope,
        message: error instanceof Error ? error.message : 'Unknown commerce error',
        properties: sanitizeProperties(properties),
      },
    }),
  );
}
