import { ConflictException, Injectable } from '@nestjs/common';
import { NullShippingAdapter } from 'src/modules/shipping/infrastructure/providers/null-shipping.adapter';
import type {
  CreateShipmentInput,
  ShipmentResult,
  ShipmentQuoteInput,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

function hasRealConfig() {
  return Boolean(
    process.env.NINETY_NINE_ENVIOS_API_BASE_URL &&
      (process.env.NINETY_NINE_ENVIOS_API_KEY ||
        (process.env.NINETY_NINE_ENVIOS_CLIENT_ID &&
          process.env.NINETY_NINE_ENVIOS_CLIENT_SECRET)),
  );
}

function blockedMessage() {
  return '99 Envíos provider está API-ready, pero faltan credenciales/endpoints oficiales. No se llama API externa ni se inventan guías.';
}

@Injectable()
export class NinetyNineEnviosAdapter extends NullShippingAdapter {
  override async getCapabilities(): Promise<Awaited<ReturnType<ShippingProviderPort['getCapabilities']>>> {
    const ready = hasRealConfig();
    const env = process.env.NINETY_NINE_ENVIOS_ENV === 'production' ? 'production' : 'sandbox';
    return {
      provider: '99envios' as const,
      ready,
      mode: ready ? env : 'pending_provider' as const,
      supportsQuote: ready,
      supportsCreateShipment: ready,
      supportsTracking: ready,
      supportsLabels: ready,
      supportsPickup: ready,
      supportsCashOnDelivery: ready && process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true',
      supportsWallet: ready,
      supportsIssues: ready,
      supportsReturns: ready,
      warnings: ready
        ? ['Credenciales presentes. Validar contra documentación oficial antes de producción.']
        : [blockedMessage()],
    };
  }

  override async getCarriers(): Promise<Awaited<ReturnType<ShippingProviderPort['getCarriers']>>> {
    if (!hasRealConfig()) {
      return [];
    }
    return [
      {
        id: '99envios-api',
        name: '99 Envíos',
        services: ['Pendiente documentación oficial'],
      },
    ];
  }

  override async quoteShipment(_input: ShipmentQuoteInput) {
    if (!hasRealConfig()) {
      return {
        provider: '99envios' as const,
        status: 'pending_provider' as const,
        carrier: null,
        service: null,
        quotedAmount: null,
        currency: 'COP',
        estimatedDays: null,
        expiresAt: null,
        warnings: [blockedMessage()],
        rawReference: null,
      };
    }

    throw new ConflictException('Documentación oficial de 99 Envíos pendiente: quoteShipment no se ejecuta contra endpoints supuestos.');
  }

  override async createShipment(_input: CreateShipmentInput): Promise<ShipmentResult> {
    throw new ConflictException(blockedMessage());
  }

  override async schedulePickup(): Promise<Awaited<ReturnType<ShippingProviderPort['schedulePickup']>>> {
    throw new ConflictException(blockedMessage());
  }
}
