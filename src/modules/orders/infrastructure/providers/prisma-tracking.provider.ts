import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  TrackingProvider,
  TrackingProviderStatus,
} from 'src/modules/orders/application/ports/tracking-provider.port';

@Injectable()
export class PrismaTrackingProvider implements TrackingProvider {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getTrackingStatus(reference: string): Promise<TrackingProviderStatus> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        order: { orderNumber: reference },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!shipment) {
      return {
        trackingNumber: null,
        carrier: null,
        estimatedDeliveryDate: null,
        rawStatus: null,
      };
    }

    return {
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.provider === 'internal' || shipment.provider === 'none'
        ? null
        : shipment.providerReference ?? shipment.provider,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate?.toISOString() ?? null,
      rawStatus: shipment.rawProviderStatus ?? shipment.status,
    };
  }

  mapProviderStatusToPublicStatus(rawStatus: string | null): string {
    const mapping: Record<string, string> = {
      pending_provider: 'pendiente_guia',
      pending_quote: 'pendiente_guia',
      quoted: 'pendiente_guia',
      pending_dispatch: 'preparando',
      shipment_created: 'preparando',
      guide_generated: 'enviado',
      pickup_scheduled: 'enviado',
      picked_up: 'en_camino',
      in_transit: 'en_camino',
      out_for_delivery: 'en_camino',
      delivered: 'entregado',
      delivery_failed: 'requiere_contacto',
      returned: 'requiere_contacto',
      cancelled: 'requiere_contacto',
      created: 'enviado',
    };

    return rawStatus ? mapping[rawStatus] ?? 'requiere_contacto' : 'pendiente_guia';
  }
}
