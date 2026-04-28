import { createApiClient } from '@/lib/api/client';
import type { PaymentIntentResponse } from '@/features/checkout/types';

const paymentsClient = createApiClient('/api/v1');

export async function initiatePayment(orderNumber: string, gateway: string) {
  const response = await paymentsClient.post<PaymentIntentResponse>(
    `/payments/${orderNumber}/initiate`,
    { gateway },
  );

  return response.data;
}

export const paymentApiCapabilities = {
  hasPublicPaymentStatusEndpoint: false,
} as const;
