import type { CartItem } from '@/features/cart/types';

export interface CheckoutFormValues {
  fullName: string;
  email: string;
  phone: string;
  document: string;
  department: string;
  city: string;
  neighborhood: string;
  postalCode: string;
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
    department?: string;
    daneCode?: string;
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
  trackingCode: string;
  status: string;
  total: string;
  currency: string;
  notification: {
    status: 'queued' | 'sent' | 'failed' | 'pending_provider';
    channel: 'email';
  };
  payment: {
    canInitiate: boolean;
    initiateUrl: string | null;
  };
  shipping?: {
    autoShippingStatus: string;
    carrier: string | null;
    guideNumber: string | null;
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

export interface PublicTrackingResponse {
  orderNumber: string | null;
  trackingCode: string | null;
  publicStatus:
    | 'recibido'
    | 'pendiente_confirmacion'
    | 'preparando'
    | 'pendiente_guia'
    | 'enviado'
    | 'en_camino'
    | 'entregado'
    | 'no_encontrado'
    | 'requiere_contacto';
  paymentStatus: string | null;
  shippingStatus: string;
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  events: Array<{
    label: string;
    description: string;
    date: string | null;
    status: string;
  }>;
  nextStep: string;
  supportAction: {
    label: string;
    href: string;
  };
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
  kind: 'success' | 'quote';
  order?: GuestCheckoutOrderResponse;
  payment?: PaymentIntentResponse['payment'];
  message?: string;
}


export interface CheckoutFormComponentProps {
  items: CartItem[];
}
