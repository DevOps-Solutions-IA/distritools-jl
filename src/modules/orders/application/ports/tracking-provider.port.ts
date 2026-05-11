export interface TrackingProviderStatus {
  trackingNumber: string | null;
  carrier: string | null;
  estimatedDeliveryDate: string | null;
  rawStatus: string | null;
}

export interface TrackingProvider {
  getTrackingStatus(reference: string): Promise<TrackingProviderStatus>;
  mapProviderStatusToPublicStatus(rawStatus: string | null): string;
}

export const TRACKING_PROVIDER = Symbol('TRACKING_PROVIDER');
