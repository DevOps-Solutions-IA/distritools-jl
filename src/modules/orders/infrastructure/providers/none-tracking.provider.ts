import { Injectable } from '@nestjs/common';
import {
  TrackingProvider,
  TrackingProviderStatus,
} from 'src/modules/orders/application/ports/tracking-provider.port';

@Injectable()
export class NoneTrackingProvider implements TrackingProvider {
  async getTrackingStatus(_reference: string): Promise<TrackingProviderStatus> {
    return {
      trackingNumber: null,
      carrier: null,
      estimatedDeliveryDate: null,
      rawStatus: null,
    };
  }

  mapProviderStatusToPublicStatus(_rawStatus: string | null): string {
    return 'pendiente_guia';
  }
}
