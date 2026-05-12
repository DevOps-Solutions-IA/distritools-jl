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
  daneCode?: string;
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
  service?: {
    idTipoEntrega?: number;
    idServicio?: number;
    carrier?: string;
    country?: string;
    creationOrigin?: number;
  };
  insurance?: {
    seguro99?: boolean;
    seguro99plus?: boolean;
  };
}

export interface ShipmentQuote {
  provider: ShippingProviderType;
  status: ShipmentStatus;
  carrier: string | null;
  carrierLabel?: string | null;
  service: string | null;
  quotedAmount: string | null;
  cashOnDeliveryAmount?: string | null;
  internalCommission?: string | null;
  surcharge?: string | null;
  insuranceAmount?: string | null;
  success?: boolean;
  message?: string | null;
  currency: string;
  estimatedDays: number | null;
  estimatedDeliveryDate?: Date | null;
  expiresAt: Date | null;
  warnings: string[];
  rawReference: Record<string, unknown> | null;
  carrierOptions?: Array<{
    carrier: string;
    carrierLabel: string;
    success: boolean;
    message: string | null;
    quotedAmount: string | null;
    cashOnDeliveryAmount: string | null;
    internalCommission: string | null;
    surcharge: string | null;
    insuranceAmount: string | null;
    estimatedDays: number | null;
    estimatedDeliveryDate: Date | null;
    serviceId: string | null;
  }>;
}

export interface CreateShipmentInput extends ShipmentQuoteInput {
  quoteReference?: string;
  recipient?: {
    documentType?: string;
    documentNumber?: string;
    firstName?: string;
    firstLastName?: string;
    secondLastName?: string;
    email?: string;
  };
  observations?: string;
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

export interface ShippingLabelInput {
  guideNumber: string;
  carrier: string;
  pdfType?: 1 | 2;
  cashOnDelivery: boolean;
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
  testConnection(): Promise<{ ok: boolean; status: string; message: string; tokenPresent?: boolean }>;
  getRateLimitStatus(): Promise<{ used: number; limit: number; remaining: number; blockedUntil: string | null; retryAfter: string | null }>;
  quoteShipment(input: ShipmentQuoteInput): Promise<ShipmentQuote>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  getShipmentStatus(trackingNumber: string): Promise<ShipmentResult>;
  cancelShipment(shipmentId: string): Promise<ShipmentResult>;
  generateLabel(input: ShippingLabelInput): Promise<{
    labelUrl: string | null;
    pdfBase64?: string | null;
    contentType?: string | null;
    labelFormat?: 'PDF_STICKER' | 'PDF_NORMAL';
    status?: string;
  }>;
  schedulePickup(input: SchedulePickupInput): Promise<{ pickupStatus: PickupStatus }>;
  getCashOnDeliveryStatus(shipmentId: string): Promise<{ status: CashOnDeliveryStatus; amount: string | null }>;
  getWalletBalance(): Promise<{ status: 'pending_provider' | 'available'; available: string | null; pending: string | null; currency: string }>;
  getWalletTransactions(): Promise<{ data: Array<Record<string, unknown>>; operationalState?: Record<string, string> }>;
  getSettlements(): Promise<{ data: Array<Record<string, unknown>>; operationalState?: Record<string, string> }>;
  getShipmentIssues(shipmentId: string): Promise<{ data: Array<Record<string, unknown>>; shipmentId: string }>;
  resolveShipmentIssue(issueId: string): Promise<{ id: string; status: string }>;
  getBranchIssues(branchCode: string): Promise<{ data: Array<Record<string, unknown>>; branchCode: string; operationalState?: Record<string, string> }>;
  updateBranchIssue(issueId: string, input: { guideNumber: string; issue: string; observations?: string }): Promise<Record<string, unknown>>;
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
