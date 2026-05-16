export interface ShippingDestinationInput {
  country: string;
  department: string;
  city: string;
  daneCode?: string;
  addressLine1: string;
  addressLine2?: string;
  neighborhood?: string;
  postalCode?: string;
  recipientName: string;
  recipientPhone: string;
  notes?: string;
}

export interface ShippingPackageInput {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValue: string;
  contentDescription: string;
}

export interface ShippingCashOnDeliveryInput {
  enabled: boolean;
  amount: string;
}

export interface ShippingInsuranceInput {
  seguro99?: boolean;
  seguro99plus?: boolean;
}

export interface ShippingServiceInput {
  idTipoEntrega?: number;
  idServicio?: number;
  carrier?: string;
  country?: string;
  creationOrigin?: number;
}

export interface ShippingRecipientInput {
  documentType?: string;
  documentNumber?: string;
  firstName?: string;
  firstLastName?: string;
  secondLastName?: string;
  email?: string;
}

export interface ShippingQuoteCommand {
  orderId: string;
  destination: ShippingDestinationInput;
  packages: ShippingPackageInput[];
  idempotencyKey: string;
  cashOnDelivery?: ShippingCashOnDeliveryInput;
  service?: ShippingServiceInput;
  insurance?: ShippingInsuranceInput;
}

export interface CreateShippingGuideCommand extends ShippingQuoteCommand {
  quoteReference?: string;
  recipient?: ShippingRecipientInput;
  observations?: string;
}

export function defaultPackage(orderNumber?: string, declaredValue?: string): ShippingPackageInput {
  return {
    weightKg: 1,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 15,
    declaredValue: declaredValue ?? '0',
    contentDescription: orderNumber ? `Pedido ${orderNumber}` : 'Mercancía DistriTools JL',
  };
}
