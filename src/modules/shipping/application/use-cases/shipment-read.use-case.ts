import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { SHIPPING_PROVIDER_PORT, ShippingProviderPort } from 'src/modules/shipping/application/ports/shipping-provider.port';

@Injectable()
export class GetShipmentDetailUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async execute(orderId: string) {
    const s = await this.prisma.shipment.findFirst({ where: { orderId }, include: { order: true, customer: true, events: true }, orderBy: { createdAt: 'desc' } });
    if (!s) throw new NotFoundException('No se encontró envío para este pedido.');
    return { id: s.id, orderId: s.orderId, provider: s.provider, status: s.status, trackingNumber: s.trackingNumber, routeNumber: s.routeNumber, labelUrl: s.labelUrl, estimatedDeliveryDate: s.estimatedDeliveryDate, createdAt: s.createdAt, updatedAt: s.updatedAt };
  }
}

@Injectable()
export class GetShipmentTrackingUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort) {}
  async execute(shipmentId: string) {
    const s = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, include: { events: { select: { id: true, status: true, occurredAt: true }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 100 } } });
    if (!s) throw new NotFoundException('Envío no encontrado.');
    if (!s.trackingNumber) return { shipmentId, trackingNumber: null, events: s.events, operationalState: { status: 'pending_guide', message: 'No hay guía externa. Se conserva tracking interno.' } };
    return { shipmentId, providerStatus: await this.provider.getShipmentStatus(s.trackingNumber), events: s.events };
  }
}

@Injectable()
export class GetShipmentLabelUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort) {}
  async execute(shipmentId: string) {
    const s = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Envío no encontrado.');
    return this.provider.generateLabel({ guideNumber: s.trackingNumber ?? s.providerShipmentId ?? shipmentId, carrier: s.provider, pdfType: 2, cashOnDelivery: false });
  }
}
