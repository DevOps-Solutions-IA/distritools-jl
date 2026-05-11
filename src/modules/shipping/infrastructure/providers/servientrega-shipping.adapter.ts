import { ConflictException, Injectable } from '@nestjs/common';
import { NullShippingAdapter } from 'src/modules/shipping/infrastructure/providers/null-shipping.adapter';
import type {
  CreateShipmentInput,
  ShipmentResult,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

@Injectable()
export class ServientregaShippingAdapter extends NullShippingAdapter {
  override async createShipment(_input: CreateShipmentInput): Promise<ShipmentResult> {
    throw new ConflictException('Servientrega credentials are not configured');
  }
}
