import { createGuestOrder } from '@/lib/api/orders';
import { initiatePayment } from '@/lib/api/payments';
import { mapCheckoutFormToOrderPayload } from '@/features/checkout/mappers';
import type {
  CheckoutSubmissionResult,
} from '@/features/checkout/types';
import type { CheckoutSchemaValues } from '@/features/checkout/schema';
import type { CartItem } from '@/features/cart/types';

export async function submitGuestCheckout(
  values: CheckoutSchemaValues,
  items: CartItem[],
): Promise<CheckoutSubmissionResult> {
  const payload = mapCheckoutFormToOrderPayload(values, items);
  const orderResponse = await createGuestOrder(payload);

  try {
    const paymentResponse = await initiatePayment(
      orderResponse.orderNumber,
      values.paymentGateway,
    );

    return {
      kind: 'success',
      order: orderResponse,
      payment: paymentResponse.payment,
    };
  } catch (error) {
    return {
      kind: 'success',
      order: orderResponse,
      message:
        error instanceof Error
          ? error.message
          : 'La orden fue creada, pero el inicio de pago no pudo completarse desde el frontend.',
    };
  }
}
