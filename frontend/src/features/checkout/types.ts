import type { CartItem } from '@/features/cart/types';

export interface CheckoutFormValues {
  fullName: string;
  email: string;
  phone: string;
  document: string;
  city: string;
  address: string;
  addressDetail: string;
  notes: string;
  paymentGateway: string;
  acceptsTerms: boolean;
}

export interface CreateGuestCheckoutPayload {
  customer: {
    fullName: string;
    email: string;
    phone: string;
    document?: string;
  };
  shippingAddress: {
    city: string;
    addressLine1: string;
    addressLine2?: string;
    notes?: string;
  };
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
  deliveryMethod?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface GuestCheckoutOrderResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
  payment: {
    canInitiate: boolean;
    initiateUrl: string;
  };
}

export interface CreateOrderResponse {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customer: {
      name: string;
      email: string;
      phone: string;
    };
    shipping: {
      address: string;
      city: string;
      notes: string | null;
    };
    totals: {
      subtotal: string;
      discountTotal: string;
      taxTotal: string;
      shippingTotal: string;
      grandTotal: string;
    };
    items: Array<{
      id: string;
      variantId: string;
      warehouseId: string;
      variantNameSnapshot: string;
      skuSnapshot: string;
      unitPrice: string;
      quantity: number;
      lineGrandTotal: string;
      lineSubtotal: string;
      lineTaxTotal: string;
      lineDiscountTotal: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PublicOrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  grandTotal: string;
  createdAt: string;
}

export interface PaymentIntentResponse {
  payment: {
    id: string;
    orderId: string;
    gateway: string;
    gatewayReference: string;
    amount: string;
    currency: string;
    status: string;
    checkoutUrl?: string;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CheckoutSubmissionResult {
  kind: 'success' | 'gap';
  order?: GuestCheckoutOrderResponse;
  payment?: PaymentIntentResponse['payment'];
  message?: string;
}

export interface CheckoutGap {
  key: 'cart-backend' | 'payment-status-public';
  title: string;
  description: string;
}

export interface CheckoutFormComponentProps {
  items: CartItem[];
}
