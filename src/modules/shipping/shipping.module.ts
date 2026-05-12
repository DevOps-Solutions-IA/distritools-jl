import { Module } from '@nestjs/common';
import {
  SHIPPING_PROVIDER_PORT,
} from 'src/modules/shipping/application/ports/shipping-provider.port';
import { ShippingController } from 'src/modules/shipping/infrastructure/http/controllers/shipping.controller';
import { CoordinadoraShippingAdapter } from 'src/modules/shipping/infrastructure/providers/coordinadora-shipping.adapter';
import { Mock99EnviosAdapter } from 'src/modules/shipping/infrastructure/providers/mock-99envios.adapter';
import { NinetyNineEnviosAdapter } from 'src/modules/shipping/infrastructure/providers/ninety-nine-envios.adapter';
import { NullShippingAdapter } from 'src/modules/shipping/infrastructure/providers/null-shipping.adapter';
import { ServientregaShippingAdapter } from 'src/modules/shipping/infrastructure/providers/servientrega-shipping.adapter';

@Module({
  controllers: [ShippingController],
  providers: [
    NullShippingAdapter,
    Mock99EnviosAdapter,
    NinetyNineEnviosAdapter,
    CoordinadoraShippingAdapter,
    ServientregaShippingAdapter,
    {
      provide: SHIPPING_PROVIDER_PORT,
      useFactory: (
        internal: NullShippingAdapter,
        mock99: Mock99EnviosAdapter,
        ninetyNine: NinetyNineEnviosAdapter,
        coordinadora: CoordinadoraShippingAdapter,
        servientrega: ServientregaShippingAdapter,
      ) => {
        const provider = process.env.SHIPPING_PROVIDER ?? 'internal';
        if (provider === 'mock_99envios') return mock99;
        if (provider === '99envios') return ninetyNine;
        if (provider === 'coordinadora') return coordinadora;
        if (provider === 'servientrega') return servientrega;
        return internal;
      },
      inject: [
        NullShippingAdapter,
        Mock99EnviosAdapter,
        NinetyNineEnviosAdapter,
        CoordinadoraShippingAdapter,
        ServientregaShippingAdapter,
      ],
    },
  ],
  exports: [SHIPPING_PROVIDER_PORT],
})
export class ShippingModule {}
