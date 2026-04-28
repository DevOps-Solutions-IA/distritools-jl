import { createApiClient } from '@/lib/api/client';
import type {
  CreateGuestCheckoutPayload,
  GuestCheckoutOrderResponse,
  PublicOrderResponse,
} from '@/features/checkout/types';

const ordersClient = createApiClient('/api/v1');

export async function createGuestOrder(payload: CreateGuestCheckoutPayload) {
  const response = await ordersClient.post<GuestCheckoutOrderResponse>(
    '/checkout/guest-order',
    payload,
  );
  return response.data;
}

export async function getPublicOrder(orderNumber: string) {
  const response = await ordersClient.get<PublicOrderResponse>(`/orders/${orderNumber}`, {
    cache: 'no-store',
  });
  return response.data;
}

export async function cancelPublicOrder(orderNumber: string, reason: string) {
  const response = await ordersClient.post(`/orders/${orderNumber}/cancel`, {
    reason,
  });
  return response.data;
}
