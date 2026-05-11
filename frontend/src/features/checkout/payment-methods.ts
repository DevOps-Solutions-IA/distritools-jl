import type { CartSummary } from '@/features/cart/types';

export type CheckoutPaymentMethodType =
  | 'cash_on_delivery'
  | 'pse'
  | 'commercial_confirmation';

export type CheckoutPaymentStatus =
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

export interface CheckoutPaymentMethod {
  id: CheckoutPaymentMethodType;
  label: string;
  description: string;
  enabled: boolean;
  requiresGateway: boolean;
  requiresOnlineRedirect: boolean;
  requiresManualConfirmation: boolean;
  allowedForQuoteOnly: boolean;
  allowedForSellable: boolean;
  allowedForMixedCart: boolean;
  unavailableReason?: string;
}

const pseEnabled = process.env.NEXT_PUBLIC_PSE_ENABLED === 'true';

const baseMethods: CheckoutPaymentMethod[] = [
  {
    id: 'cash_on_delivery',
    label: 'Pago contra entrega',
    description: 'Pagas al recibir, sujeto a cobertura y confirmación.',
    enabled: true,
    requiresGateway: false,
    requiresOnlineRedirect: false,
    requiresManualConfirmation: true,
    allowedForQuoteOnly: false,
    allowedForSellable: true,
    allowedForMixedCart: true,
  },
  {
    id: 'pse',
    label: 'PSE',
    description: pseEnabled
      ? 'Serás redirigido al proveedor bancario para autorizar el pago.'
      : 'PSE no disponible en este momento.',
    enabled: pseEnabled,
    requiresGateway: true,
    requiresOnlineRedirect: true,
    requiresManualConfirmation: false,
    allowedForQuoteOnly: false,
    allowedForSellable: true,
    allowedForMixedCart: false,
    unavailableReason: pseEnabled ? undefined : 'Configura un proveedor PSE para habilitarlo.',
  },
  {
    id: 'commercial_confirmation',
    label: 'Coordinar pago',
    description: 'Confirmamos disponibilidad, cobertura y valor final antes del pago.',
    enabled: true,
    requiresGateway: false,
    requiresOnlineRedirect: false,
    requiresManualConfirmation: true,
    allowedForQuoteOnly: true,
    allowedForSellable: true,
    allowedForMixedCart: true,
  },
];

export function getCheckoutPaymentMethods(summary: CartSummary) {
  return baseMethods.map((method) => {
    const allowed =
      summary.hasQuoteItems && !summary.hasPricedItems
        ? method.allowedForQuoteOnly
        : summary.hasQuoteItems && summary.hasPricedItems
          ? method.allowedForMixedCart
          : method.allowedForSellable;

    return {
      ...method,
      enabled: method.enabled && allowed,
      unavailableReason: !allowed
        ? 'No aplica para esta selección.'
        : method.unavailableReason,
    };
  });
}

export function getDefaultPaymentMethod(summary: CartSummary): CheckoutPaymentMethodType {
  if (summary.hasQuoteItems && !summary.hasPricedItems) {
    return 'commercial_confirmation';
  }

  if (summary.hasQuoteItems) {
    return 'commercial_confirmation';
  }

  return 'cash_on_delivery';
}
