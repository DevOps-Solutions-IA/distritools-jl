export type PaymentMethodType =
  | 'cash_on_delivery'
  | 'pse'
  | 'commercial_confirmation';

export type PaymentLifecycleStatus =
  | 'pending_selection'
  | 'pending_confirmation'
  | 'pending_gateway_redirect'
  | 'pending_bank_authorization'
  | 'approved'
  | 'declined'
  | 'expired'
  | 'failed'
  | 'cancelled'
  | 'cash_on_delivery_pending'
  | 'cash_collected'
  | 'refunded';

export interface PaymentMethodDefinition {
  id: PaymentMethodType;
  label: string;
  enabled: boolean;
  requiresGateway: boolean;
  requiresOnlineRedirect: boolean;
  requiresManualConfirmation: boolean;
  allowedForQuoteOnly: boolean;
  allowedForSellable: boolean;
  allowedForMixedCart: boolean;
}

export const PAYMENT_METHODS: Record<PaymentMethodType, PaymentMethodDefinition> = {
  cash_on_delivery: {
    id: 'cash_on_delivery',
    label: 'Pago contra entrega',
    enabled: true,
    requiresGateway: false,
    requiresOnlineRedirect: false,
    requiresManualConfirmation: true,
    allowedForQuoteOnly: false,
    allowedForSellable: true,
    allowedForMixedCart: true,
  },
  pse: {
    id: 'pse',
    label: 'PSE',
    enabled: false,
    requiresGateway: true,
    requiresOnlineRedirect: true,
    requiresManualConfirmation: false,
    allowedForQuoteOnly: false,
    allowedForSellable: true,
    allowedForMixedCart: false,
  },
  commercial_confirmation: {
    id: 'commercial_confirmation',
    label: 'Coordinar pago',
    enabled: true,
    requiresGateway: false,
    requiresOnlineRedirect: false,
    requiresManualConfirmation: true,
    allowedForQuoteOnly: true,
    allowedForSellable: true,
    allowedForMixedCart: true,
  },
};

export function isPaymentMethodType(value: string): value is PaymentMethodType {
  return Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, value);
}
