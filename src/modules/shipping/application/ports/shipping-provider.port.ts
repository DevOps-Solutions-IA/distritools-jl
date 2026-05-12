import type {
  CashOnDeliveryStatus,
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
  orderId?: string;
  origin?: ShipmentAddress;
  destination: ShipmentAddress;
  packages: ShipmentPackage[];
  idempotencyKey: string;
  cashOnDelivery?: {
    enabled: boolean;
    amount: string;
  };
}

export interface ShipmentQuote {
  provider: ShippingProviderType;
  status: ShipmentStatus;
  carrier: string | null;
  service: string | null;
  quotedAmount: string | null;
  currency: string;
  estimatedDays: number | null;
  expiresAt: Date | null;
  warnings: string[];
  rawReference: Record<string, unknown> | null;
}

export interface CreateShipmentInput extends ShipmentQuoteInput {
  quoteReference?: string;
}

export interface ShipmentResult {
  id: string | null;
  provider: ShippingProviderType;
  status: ShipmentStatus;
  quotedAmount: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  routeNumber: string | null;
  labelUrl: string | null;
  pickupStatus: PickupStatus;
  cashOnDeliveryStatus: CashOnDeliveryStatus;
  estimatedDeliveryDate: Date | null;
  rawStatus: string | null;
  warnings: string[];
}

export interface SchedulePickupInput {
  shipmentId: string;
  scheduledDate: Date;
}

export interface ShippingProviderPort {
  getCapabilities(): Promise<{
    provider: ShippingProviderType;
    ready: boolean;
    mode: 'internal' | 'mock' | 'sandbox' | 'production' | 'pending_provider';
    supportsQuote: boolean;
    supportsCreateShipment: boolean;
    supportsTracking: boolean;
    supportsLabels: boolean;
    supportsPickup: boolean;
    supportsCashOnDelivery: boolean;
    supportsWallet: boolean;
    supportsIssues: boolean;
    supportsReturns: boolean;
    warnings: string[];
  }>;
  getCarriers(): Promise<Array<{ id: string; name: string; services: string[] }>>;
  quoteShipment(input: ShipmentQuoteInput): Promise<ShipmentQuote>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  getShipmentStatus(trackingNumber: string): Promise<ShipmentResult>;
  cancelShipment(shipmentId: string): Promise<ShipmentResult>;
  generateLabel(shipmentId: string): Promise<{ labelUrl: string | null }>;
  schedulePickup(input: SchedulePickupInput): Promise<{ pickupStatus: PickupStatus }>;
  getCashOnDeliveryStatus(shipmentId: string): Promise<{ status: CashOnDeliveryStatus; amount: string | null }>;
  getWalletBalance(): Promise<{ status: 'pending_provider' | 'available'; available: string | null; pending: string | null; currency: string }>;
  getWalletTransactions(): Promise<{ data: Array<Record<string, unknown>>; operationalState?: Record<string, string> }>;
  getSettlements(): Promise<{ data: Array<Record<string, unknown>>; operationalState?: Record<string, string> }>;
  getShipmentIssues(shipmentId: string): Promise<{ data: Array<Record<string, unknown>>; shipmentId: string }>;
  resolveShipmentIssue(issueId: string): Promise<{ id: string; status: string }>;
  getReturns(shipmentId: string): Promise<{ data: Array<Record<string, unknown>>; shipmentId: string }>;
  handleWebhook(input: { headers: Record<string, string | string[] | undefined>; body: unknown }): Promise<{
    accepted: boolean;
    duplicate: boolean;
    eventId: string | null;
    eventName: string | null;
    externalShipmentId: string | null;
    status: ShipmentStatus | null;
    rawStatus: string | null;
  }>;
}

export const SHIPPING_PROVIDER_PORT = Symbol('SHIPPING_PROVIDER_PORT');
