import { Inject, Injectable } from '@nestjs/common';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from 'src/modules/orders/domain/repositories/order.repository';
import {
  TRACKING_PROVIDER,
  TrackingProvider,
} from 'src/modules/orders/application/ports/tracking-provider.port';

export type PublicTrackingStatus =
  | 'recibido'
  | 'pendiente_confirmacion'
  | 'preparando'
  | 'pendiente_guia'
  | 'enviado'
  | 'en_camino'
  | 'entregado'
  | 'no_encontrado'
  | 'requiere_contacto';

function mapOrderStatusToPublicStatus(status: string): PublicTrackingStatus {
  const mapping: Record<string, PublicTrackingStatus> = {
    draft: 'pendiente_confirmacion',
    pending_payment: 'recibido',
    paid: 'preparando',
    packed: 'pendiente_guia',
    shipped: 'enviado',
    delivered: 'entregado',
    cancelled: 'requiere_contacto',
    refunded: 'requiere_contacto',
  };

  return mapping[status] ?? 'pendiente_confirmacion';
}

@Injectable()
export class TrackOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(TRACKING_PROVIDER)
    private readonly trackingProvider: TrackingProvider,
  ) {}

  async execute(query: string) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return this.notFoundResponse();
    }

    const order = await this.orderRepository.findByOrderNumber(normalizedQuery);
    if (!order) {
      return this.notFoundResponse();
    }

    const providerStatus = await this.trackingProvider.getTrackingStatus(order.orderNumber);
    const publicStatus = providerStatus.rawStatus
      ? (this.trackingProvider.mapProviderStatusToPublicStatus(providerStatus.rawStatus) as PublicTrackingStatus)
      : mapOrderStatusToPublicStatus(order.status);
    const shippingStatus: PublicTrackingStatus =
      providerStatus.trackingNumber || providerStatus.carrier ? publicStatus : 'pendiente_guia';

    return {
      orderNumber: order.orderNumber,
      publicStatus,
      paymentStatus: order.status === 'paid' ? 'confirmado' : 'pendiente_confirmacion',
      shippingStatus,
      trackingNumber: providerStatus.trackingNumber,
      carrier: providerStatus.carrier,
      estimatedDeliveryDate: providerStatus.estimatedDeliveryDate,
      events: [
        {
          label: 'Pedido recibido',
          description: 'Recibimos tu solicitud de compra y la estamos validando.',
          date: order.createdAt.toISOString(),
          status: 'recibido',
        },
        {
          label: providerStatus.trackingNumber ? 'Guía asignada' : 'Guía pendiente de asignación',
          description: providerStatus.trackingNumber
            ? 'La guía fue asignada por un proveedor real.'
            : 'Seguimiento operativo interno. No se inventa guía, transportadora ni ruta.',
          date: null,
          status: shippingStatus,
        },
      ],
      nextStep: providerStatus.trackingNumber
        ? 'Consulta el avance logístico con la guía entregada por la transportadora.'
        : 'Te contactaremos cuando la operación logística tenga guía real.',
      supportAction: {
        label: 'Contactar soporte',
        href: '/contacto',
      },
    };
  }

  private notFoundResponse() {
    return {
      orderNumber: null,
      publicStatus: 'no_encontrado' as const,
      paymentStatus: null,
      shippingStatus: 'no_encontrado' as const,
      trackingNumber: null,
      carrier: null,
      estimatedDeliveryDate: null,
      events: [],
      nextStep: 'Revisa el número o contacta soporte para validar la información.',
      supportAction: {
        label: 'Contactar soporte',
        href: '/contacto',
      },
    };
  }
}
