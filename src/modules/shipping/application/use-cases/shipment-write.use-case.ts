import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { SHIPPING_PROVIDER_PORT, ShippingProviderPort } from 'src/modules/shipping/application/ports/shipping-provider.port';

function safeActor(a: { sub: string }): string | null { return a.sub === '00000000-0000-7000-8000-000000000099' ? null : a.sub; }

@Injectable()
export class CancelShipmentUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort) {}
  async execute(shipmentId: string, reason: string | undefined, actor: { sub: string }, ipAddress: string, userAgent?: string) {
    const s = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Envío no encontrado.');
    if (s.status === 'cancelled' || s.status === 'delivered') throw new ConflictException('El envío ya está cancelado o entregado.');
    const providerId = s.providerShipmentId ?? s.trackingNumber ?? shipmentId;
    const result = await this.provider.cancelShipment(providerId);
    const updated = await this.prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'cancelled', rawProviderStatus: result.rawStatus, lastSyncAt: new Date(), updatedById: safeActor(actor) } });
    await this.prisma.shipmentEvent.create({ data: { id: uuidv7(), shipmentId, status: 'cancelled', description: reason ?? 'Cancelado desde admin.', occurredAt: new Date() } });
    await this.prisma.auditLog.create({ data: { id: uuidv7(), actorUserId: actor.sub, action: 'shipping.shipment_cancelled', entityType: 'shipment', entityId: shipmentId, afterData: { reason, providerStatus: result.rawStatus } as never, ipAddress, userAgent } });
    return updated;
  }
}

@Injectable()
export class SyncShipmentUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort) {}
  async execute(shipmentId: string, actor: { sub: string }, ipAddress: string, userAgent?: string) {
    const s = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, include: { events: true } });
    if (!s) throw new NotFoundException('Envío no encontrado.');
    const trackingNumber = s.trackingNumber ?? s.providerShipmentId ?? shipmentId;
    const result = await this.provider.getShipmentStatus(trackingNumber);
    const updated = await this.prisma.shipment.update({ where: { id: shipmentId }, data: { status: result.status as never, rawProviderStatus: result.rawStatus, lastSyncAt: new Date(), updatedById: safeActor(actor) }, include: { events: true } });
    await this.prisma.shipmentEvent.create({ data: { id: uuidv7(), shipmentId, status: updated.status, providerStatus: result.rawStatus, description: 'Sincronizado con transportadora.', occurredAt: new Date() } });
    await this.prisma.auditLog.create({ data: { id: uuidv7(), actorUserId: actor.sub, action: 'shipping.shipment_synced', entityType: 'shipment', entityId: shipmentId, afterData: { status: result.status } as never, ipAddress, userAgent } });
    return updated;
  }
}

@Injectable()
export class ProcessShippingWebhookUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort) {}
  async execute(body: unknown, headers?: Record<string, string | string[] | undefined>) {
    const secret = process.env.NINETY_NINE_ENVIOS_WEBHOOK_SECRET;
    if (secret) {
      const signature = headers?.['x-99envios-signature'] ?? headers?.['x-webhook-secret'];
      if (signature !== secret) {
        throw new UnauthorizedException('Firma de webhook inválida.');
      }
    }

    const result = await this.provider.handleWebhook({ headers: headers ?? {}, body });
    if (!result.accepted) {
      return { accepted: false, operationalState: { status: 'pending_provider', message: 'Webhook recibido pero provider real no está configurado.' } };
    }

    const eventId = result.eventId ?? uuidv7();
    const existing = await this.prisma.auditLog.findFirst({ where: { action: 'shipping.webhook_99envios', entityId: eventId } });
    if (existing) return { accepted: true, duplicate: true, eventId };

    const shipment = result.externalShipmentId
      ? await this.prisma.shipment.findFirst({ where: { OR: [{ providerShipmentId: result.externalShipmentId }, { trackingNumber: result.externalShipmentId }] }, include: { order: true, customer: true, events: true } })
      : null;

    if (shipment && result.status) {
      const status: PrismaShipmentStatus = result.status === 'provider_unknown' ? 'delivery_failed' : result.status as PrismaShipmentStatus;
      await this.prisma.shipment.update({ where: { id: shipment.id }, data: { status, rawProviderStatus: result.rawStatus, lastSyncAt: new Date() } });
      await this.prisma.shipmentEvent.create({ data: { id: uuidv7(), shipmentId: shipment.id, status, providerStatus: result.rawStatus, description: result.eventName ?? 'Webhook 99 Envíos procesado.', rawPayload: body ? (typeof body === 'object' ? (body as Record<string,unknown>) as never : undefined) : undefined, occurredAt: new Date() } });
    }

    await this.prisma.auditLog.create({ data: { id: uuidv7(), action: 'shipping.webhook_99envios', entityType: 'shipment', entityId: eventId, afterData: (body && typeof body === 'object' ? body as Record<string,unknown> : undefined) as never } });
    return { accepted: true, duplicate: false, eventId, shipmentUpdated: Boolean(shipment) };
  }
}
