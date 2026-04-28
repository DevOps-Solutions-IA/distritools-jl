export interface CreatePaymentIntentPayload {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: string;
  currency: string;
}

export interface PaymentIntentResult {
  gatewayReference: string;
  checkoutUrl: string;
  expiresAt: Date | null;
}

export interface ParsedWebhookPayload {
  externalEventId: string;
  gatewayReference: string;
  transactionId?: string;
  status: 'approved' | 'rejected' | 'expired';
  rawPayload: unknown;
}

export interface PaymentGatewayPort {
  createIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResult>;
}

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');
