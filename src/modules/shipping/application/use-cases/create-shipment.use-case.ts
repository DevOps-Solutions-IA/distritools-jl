import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { ShippingProviderInputMapper } from 'src/modules/shipping/application/services/shipping-provider-input.mapper';
import { SHIPPING_PROVIDER_PORT, ShippingProviderPort } from 'src/modules/shipping/application/ports/shipping-provider.port';
import type { ShipmentStatus } from 'src/modules/shipping/domain/shipping-status';

const ACTIVE: PrismaShipmentStatus[] = ['pending_quote','quoted','pending_dispatch','shipment_created','guide_generated','pickup_scheduled','in_transit','out_for_delivery'];
function toP(s: ShipmentStatus): PrismaShipmentStatus { return s === 'provider_unknown' ? 'delivery_failed' : s as PrismaShipmentStatus; }
function safeA(a: { sub: string }): string | null { return a.sub === '00000000-0000-7000-8000-000000000099' ? null : a.sub; }

@Injectable()
export class CreateShipmentUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort,
    @Inject(ShippingProviderInputMapper) private readonly mapper: ShippingProviderInputMapper,
  ) {}

  async execute(input: { orderId: string; body: Record<string,unknown>; actor: { sub: string }; ipAddress: string; userAgent?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id: input.orderId }, include: { orderItems: true, shipments: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado.');
    if (order.shipments.find((s) => ACTIVE.includes(s.status))?.trackingNumber) throw new ConflictException('El pedido ya tiene una guía activa.');

    const customer = await this.prisma.customer.upsert({
      where: { email: order.customerEmail.trim().toLowerCase() },
      create: { id: uuidv7(), fullName: order.customerName, email: order.customerEmail.trim().toLowerCase(), phone: order.customerPhone, defaultAddress: order.shippingAddress, city: order.shippingCity, country: 'CO', lastOrderAt: order.createdAt },
      update: { fullName: order.customerName, phone: order.customerPhone, defaultAddress: order.shippingAddress, city: order.shippingCity, lastOrderAt: order.createdAt },
    });

    const command = this.mapper.buildQuoteCommandFromOrder(input.body, input.orderId, order);
    const providerInput = this.mapper.buildCreateShipmentInput({ ...command, quoteReference: input.body.quoteReference as string|undefined, recipient: input.body.recipient as Record<string,unknown>|undefined, observations: input.body.observations as string|undefined });
    const result = await this.provider.createShipment(providerInput);

    const status = toP(result.status);
    const existing = await this.prisma.shipment.findFirst({ where: { orderId: input.orderId, provider: result.provider } });
    const base = { status, quotedAmount: result.quotedAmount ?? undefined, trackingNumber: result.trackingNumber ?? undefined, routeNumber: result.routeNumber ?? undefined, labelUrl: result.labelUrl ?? undefined, providerShipmentId: result.id ?? undefined, providerReference: (result.carrier ?? result.rawStatus) ?? undefined, estimatedDeliveryDate: result.estimatedDeliveryDate ?? undefined, packageSnapshot: (command.packages as unknown as Prisma.InputJsonValue), rawProviderStatus: result.rawStatus ?? undefined, lastSyncAt: new Date(), updatedById: safeA(input.actor) };
    const addr = { address: '[redacted]', city: order.shippingCity, customer: order.customerEmail.replace(/^(.{2}).*(@.*)$/, '$1***$2') } as Prisma.InputJsonValue;

    const shipment = existing
      ? await this.prisma.shipment.update({ where: { id: existing.id }, data: base, include: { order: true, customer: true, events: true } })
      : await this.prisma.shipment.create({ data: { id: uuidv7(), orderId: input.orderId, customerId: customer.id, provider: result.provider, addressSnapshot: addr, createdById: safeA(input.actor), ...base }, include: { order: true, customer: true, events: true } });

    await this.prisma.shipmentEvent.create({ data: { id: uuidv7(), shipmentId: shipment.id, status, providerStatus: result.rawStatus, description: 'Guía creada o preparada desde provider logístico.', occurredAt: new Date() } });
    await this.prisma.auditLog.create({ data: { id: uuidv7(), actorUserId: input.actor.sub, action: 'shipping.shipment_created', entityType: 'shipment', entityId: shipment.id, afterData: { provider: result.provider, status, trackingNumber: result.trackingNumber ? '[present]' : null, warnings: result.warnings } as never, ipAddress: input.ipAddress, userAgent: input.userAgent } });

    return { id: shipment.id, orderId: shipment.orderId, provider: shipment.provider, status: shipment.status, trackingNumber: shipment.trackingNumber, routeNumber: shipment.routeNumber, labelUrl: shipment.labelUrl, estimatedDeliveryDate: shipment.estimatedDeliveryDate, createdAt: shipment.createdAt, updatedAt: shipment.updatedAt, providerWarnings: result.warnings };
  }
}
