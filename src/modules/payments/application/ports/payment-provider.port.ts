import type {
  PaymentLifecycleStatus,
  PaymentMethodType,
} from 'src/modules/payments/domain/payment-methods';

export interface CreateProviderPaymentIntentInput {
  orderId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  method: PaymentMethodType;
  idempotencyKey: string;
  returnUrl?: string;
}

export interface ProviderPaymentIntent {
  provider: string;
  providerReference: string;
  status: PaymentLifecycleStatus;
  redirectUrl: string | null;
  expiresAt: Date | null;
}

export interface ProviderPaymentStatus {
  provider: string;
  providerReference: string;
  status: PaymentLifecycleStatus;
  amount?: string;
  currency?: string;
}

export interface ProviderWebhookResult {
  provider: string;
  providerReference: string;
  status: PaymentLifecycleStatus;
  rawEventId: string;
}

export interface RefundPaymentInput {
  providerReference: string;
  amount?: string;
  reason?: string;
}

export interface PaymentProviderPort {
  createPaymentIntent(
    input: CreateProviderPaymentIntentInput,
  ): Promise<ProviderPaymentIntent>;
  getPaymentStatus(providerReference: string): Promise<ProviderPaymentStatus>;
  handleWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<ProviderWebhookResult>;
  refundPayment(input: RefundPaymentInput): Promise<ProviderPaymentStatus>;
}

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');
