export type ShippingProviderType =
  | 'none'
  | 'internal'
  | 'mock_99envios'
  | '99envios'
  | 'coordinadora'
  | 'servientrega';

export type ShipmentStatus =
  | 'pending_provider'
  | 'pending_address'
  | 'pending_quote'
  | 'quoted'
  | 'pending_dispatch'
  | 'shipment_created'
  | 'guide_generated'
  | 'pickup_scheduled'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'provider_unknown'
  | 'returned'
  | 'cancelled';

export type PickupStatus =
  | 'not_required'
  | 'pending'
  | 'scheduled'
  | 'picked_up'
  | 'failed'
  | 'cancelled';

export type CashOnDeliveryStatus =
  | 'not_enabled'
  | 'pending'
  | 'collected'
  | 'not_collected'
  | 'settled'
  | 'rejected';
