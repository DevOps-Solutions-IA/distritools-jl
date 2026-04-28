import { ApiError } from '@/lib/api/errors';
import type { CartItem } from '@/features/cart/types';
import type {
  CheckoutGap,
  CreateGuestCheckoutPayload,
} from '@/features/checkout/types';
import type { CheckoutSchemaValues } from '@/features/checkout/schema';

export const checkoutBackendGaps: CheckoutGap[] = [
  {
    key: 'cart-backend',
    title: 'Carrito backend no expuesto públicamente',
    description:
      'No existe endpoint público de carrito. En Fase 3 el carrito opera en LocalStorage con sincronización futura lista.',
  },
  {
    key: 'payment-status-public',
    title: 'Estado público de pago no expuesto',
    description:
      'Existe inicio de pago, pero no un endpoint público de consulta de pago. La confirmación definitiva sigue dependiendo del backend/webhook.',
  },
];

export function mapCheckoutFormToOrderPayload(
  values: CheckoutSchemaValues,
  items: CartItem[],
): CreateGuestCheckoutPayload {
  if (!items.length) {
    throw new ApiError({
      status: 400,
      message: 'No puedes crear una orden con el carrito vacío.',
    });
  }

  const lines = items.map((item) => ({
      productId: item.product.id,
      variantId: item.variant.id,
      quantity: item.quantity,
    }));

  return {
    customer: {
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      document: values.document.trim() || undefined,
    },
    shippingAddress: {
      city: values.city.trim(),
      addressLine1: values.address.trim(),
      addressLine2: values.addressDetail.trim() || undefined,
      notes: values.notes.trim() || undefined,
    },
    items: lines,
    deliveryMethod: 'standard',
    paymentMethod: values.paymentGateway,
    notes: values.notes.trim() || undefined,
  };
}
