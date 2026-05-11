import { Module } from '@nestjs/common';
import {
  SHIPPING_PROVIDER_PORT,
} from 'src/modules/shipping/application/ports/shipping-provider.port';
import { CoordinadoraShippingAdapter } from 'src/modules/shipping/infrastructure/providers/coordinadora-shipping.adapter';
import { NullShippingAdapter } from 'src/modules/shipping/infrastructure/providers/null-shipping.adapter';
import { ServientregaShippingAdapter } from 'src/modules/shipping/infrastructure/providers/servientrega-shipping.adapter';

@Module({
  providers: [
    NullShippingAdapter,
    CoordinadoraShippingAdapter,
    ServientregaShippingAdapter,
    {
      provide: SHIPPING_PROVIDER_PORT,
      useExisting: NullShippingAdapter,
    },
  ],
  exports: [SHIPPING_PROVIDER_PORT],
})
export class ShippingModule {}
