export type ShippingProviderType = 'none' | 'coordinadora' | 'servientrega';

export type ShipmentStatus =
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
  | 'returned'
  | 'cancelled';

export type PickupStatus =
  | 'not_required'
  | 'pending'
  | 'scheduled'
  | 'picked_up'
  | 'failed'
  | 'cancelled';
