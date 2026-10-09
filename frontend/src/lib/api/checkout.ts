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
  idempotencyKey?: string,
): Promise<CheckoutSubmissionResult> {
  if (items.some((item) => item.variant.mode === 'quote')) {
    return {
      kind: 'quote',
      message:
        'Recibimos tu solicitud. Confirmaremos precio y disponibilidad antes de finalizar.',
    };
  }

  const payload = mapCheckoutFormToOrderPayload(values, items);
  const orderResponse = await createGuestOrder(payload, idempotencyKey);

  if (values.paymentGateway !== 'pse') {
    return {
      kind: 'success',
      order: orderResponse,
      message:
        values.paymentGateway === 'cash_on_delivery'
          ? 'Pago contra entrega seleccionado. Confirmaremos cobertura y disponibilidad antes del despacho.'
          : 'Coordinaremos el pago después de confirmar disponibilidad y entrega.',
    };
  }

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
          : 'La orden fue creada. Te contactaremos para finalizar la compra.',
    };
  }
}
