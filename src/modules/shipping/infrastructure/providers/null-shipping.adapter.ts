import { ConflictException, Injectable } from '@nestjs/common';
import type {
  CreateShipmentInput,
  SchedulePickupInput,
  ShipmentQuote,
  ShipmentQuoteInput,
  ShipmentResult,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

@Injectable()
export class NullShippingAdapter implements ShippingProviderPort {
  async quoteShipment(_input: ShipmentQuoteInput): Promise<ShipmentQuote> {
    return {
      provider: 'none',
      status: 'pending_quote',
      quotedAmount: null,
      currency: 'COP',
      expiresAt: null,
    };
  }

  async createShipment(_input: CreateShipmentInput): Promise<ShipmentResult> {
    return this.emptyShipment();
  }

  async getShipmentStatus(_trackingNumber: string): Promise<ShipmentResult> {
    return this.emptyShipment();
  }

  async cancelShipment(_shipmentId: string): Promise<ShipmentResult> {
    return {
      ...this.emptyShipment(),
      status: 'cancelled',
    };
  }

  async generateLabel(_shipmentId: string): Promise<{ labelUrl: string | null }> {
    return { labelUrl: null };
  }

  async schedulePickup(_input: SchedulePickupInput): Promise<{ pickupStatus: 'pending' }> {
    throw new ConflictException('Shipping provider is not configured');
  }

  private emptyShipment(): ShipmentResult {
    return {
      id: null,
      provider: 'none',
      status: 'pending_dispatch',
      quotedAmount: null,
      trackingNumber: null,
      routeNumber: null,
      labelUrl: null,
      pickupStatus: 'not_required',
      estimatedDeliveryDate: null,
    };
  }
}
