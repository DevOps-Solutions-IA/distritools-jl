import { ApiError } from '@/lib/api/errors';
import type { CartItem } from '@/features/cart/types';
import type { CreateGuestCheckoutPayload } from '@/features/checkout/types';
import type { CheckoutSchemaValues } from '@/features/checkout/schema';

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

  if (items.some((item) => item.variant.mode === 'quote')) {
    throw new ApiError({
      status: 422,
      message: 'Los productos por cotizar requieren confirmación comercial.',
    });
  }

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
      addressLine2: [
        values.addressDetail.trim(),
        values.neighborhood.trim() ? `Barrio: ${values.neighborhood.trim()}` : '',
        values.postalCode.trim() ? `CP: ${values.postalCode.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | ') || undefined,
      notes:
        [
          values.department.trim() ? `Departamento: ${values.department.trim()}` : '',
          values.notes.trim(),
        ]
          .filter(Boolean)
          .join(' | ') || undefined,
    },
    items: lines,
    deliveryMethod: 'standard',
    paymentMethod: values.paymentGateway,
    notes: values.notes.trim() || undefined,
  };
}
