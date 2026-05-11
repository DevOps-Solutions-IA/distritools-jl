import type {
  PickupStatus,
  ShipmentStatus,
  ShippingProviderType,
} from 'src/modules/shipping/domain/shipping-status';

export interface ShipmentAddress {
  country: string;
  department: string;
  city: string;
  addressLine1: string;
  addressLine2?: string;
  neighborhood?: string;
  postalCode?: string;
  recipientName: string;
  recipientPhone: string;
  notes?: string;
}

export interface ShipmentPackage {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValue: string;
  contentDescription: string;
}

export interface ShipmentQuoteInput {
  orderId: string;
  destination: ShipmentAddress;
  packages: ShipmentPackage[];
  idempotencyKey: string;
}

export interface ShipmentQuote {
  provider: ShippingProviderType;
  status: ShipmentStatus;
  quotedAmount: string | null;
  currency: string;
  expiresAt: Date | null;
}

export interface CreateShipmentInput extends ShipmentQuoteInput {
  quoteReference?: string;
}

export interface ShipmentResult {
  id: string | null;
  provider: ShippingProviderType;
  status: ShipmentStatus;
  quotedAmount: string | null;
  trackingNumber: string | null;
  routeNumber: string | null;
  labelUrl: string | null;
  pickupStatus: PickupStatus;
  estimatedDeliveryDate: Date | null;
}

export interface SchedulePickupInput {
  shipmentId: string;
  scheduledDate: Date;
}

export interface ShippingProviderPort {
  quoteShipment(input: ShipmentQuoteInput): Promise<ShipmentQuote>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  getShipmentStatus(trackingNumber: string): Promise<ShipmentResult>;
  cancelShipment(shipmentId: string): Promise<ShipmentResult>;
  generateLabel(shipmentId: string): Promise<{ labelUrl: string | null }>;
  schedulePickup(input: SchedulePickupInput): Promise<{ pickupStatus: PickupStatus }>;
}

export const SHIPPING_PROVIDER_PORT = Symbol('SHIPPING_PROVIDER_PORT');
