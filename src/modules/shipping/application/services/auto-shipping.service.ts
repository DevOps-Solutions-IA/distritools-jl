import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from 'src/common/events/domain-event.publisher';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SHIPPING_PROVIDER_PORT,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';
import { AutoShippingEligibilityService } from 'src/modules/shipping/application/services/auto-shipping-eligibility.service';
import { AutoShippingProviderService } from 'src/modules/shipping/application/services/auto-shipping-provider.service';
import { CarrierSelectionService, CarrierCandidate } from 'src/modules/shipping/application/services/carrier-selection.service';

type AutoShippingMode = 'disabled' | 'quote_only' | 'quote_and_create_guide';

interface AutoShippingInput {
  orderId: string;
  paymentMethod?: string;
  customerDocument?: string;
  destinationDaneCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

function autoConfig() {
  return {
    enabled: process.env.AUTO_SHIPPING_ENABLED === 'true',
    mode: (process.env.AUTO_SHIPPING_MODE ?? 'disabled') as AutoShippingMode,
    strategy: process.env.AUTO_SHIPPING_SELECT_STRATEGY ?? 'cheapest_successful',
    failsafe: process.env.AUTO_SHIPPING_FAILSAFE !== 'false',
    requireDane: process.env.AUTO_SHIPPING_REQUIRE_DANE !== 'false',
    requireDimensions: process.env.AUTO_SHIPPING_REQUIRE_DIMENSIONS !== 'false',
    createLabelAfterGuide: process.env.AUTO_SHIPPING_CREATE_LABEL_AFTER_GUIDE === 'true',
    notifyAdmin: process.env.AUTO_SHIPPING_NOTIFY_ADMIN !== 'false',
    notifyCustomer: process.env.AUTO_SHIPPING_NOTIFY_CUSTOMER === 'true',
    defaultDaneCode: process.env.AUTO_SHIPPING_DEFAULT_DESTINATION_DANE_CODE ?? null,
    defaultDepartment: process.env.AUTO_SHIPPING_DEFAULT_DESTINATION_DEPARTMENT ?? 'Valle del Cauca',
    defaultWeightKg: Number(process.env.AUTO_SHIPPING_DEFAULT_WEIGHT_KG ?? '0'),
    defaultLengthCm: Number(process.env.AUTO_SHIPPING_DEFAULT_LENGTH_CM ?? '0'),
    defaultWidthCm: Number(process.env.AUTO_SHIPPING_DEFAULT_WIDTH_CM ?? '0'),
    defaultHeightCm: Number(process.env.AUTO_SHIPPING_DEFAULT_HEIGHT_CM ?? '0'),
  };
}

function isDane(value: string | null | undefined) {
  return typeof value === 'string' && /^[0-9]{8}$/.test(value);
}

function redactPayload(payload: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!payload || typeof payload !== 'object') return Prisma.JsonNull;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (/email|phone|address|document|token|secret|password/i.test(key)) {
      output[key] = '[redacted]';
    } else {
      output[key] = value as Prisma.InputJsonValue;
    }
  }
  return output as Prisma.InputJsonValue;
}

@Injectable()
export class AutoShippingService {
  private readonly logger = new Logger(AutoShippingService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER_PORT)
    private readonly provider: ShippingProviderPort,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
    @Inject(AutoShippingEligibilityService)
    private readonly eligibility: AutoShippingEligibilityService,
    @Inject(CarrierSelectionService)
    private readonly carrierSelection: CarrierSelectionService,
    @Inject(AutoShippingProviderService)
    private readonly shippingProvider: AutoShippingProviderService,
  ) {}

  async runAfterCheckout(input: AutoShippingInput) {
    const cfg = autoConfig();
    if (!cfg.enabled || cfg.mode === 'disabled') {
      return { status: 'disabled', guideNumber: null, carrier: null };
    }

    try {
      return await this.execute(input);
    } catch (error) {
      if (!cfg.failsafe) throw error;
      this.logger.warn(`Auto-shipping failed safely for order ${input.orderId}: ${this.safeError(error)}`);
      await this.markFailure(input.orderId, 'auto_shipping_failed', this.safeError(error), input);
      return { status: 'auto_shipping_failed', guideNumber: null, carrier: null };
    }
  }

  private async execute(input: AutoShippingInput) {
    const cfg = autoConfig();
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        orderItems: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
        shipments: true,
      },
    });

    if (!order) return { status: 'order_not_found', guideNumber: null, carrier: null };

    const providerCapabilities = await this.shippingProvider.fetchCapabilities();
    const existingGuide = order.shipments.find((shipment) => shipment.trackingNumber || shipment.providerShipmentId);
    if (existingGuide) {
      return {
        status: 'already_has_guide',
        guideNumber: existingGuide.trackingNumber,
        carrier: existingGuide.providerReference,
      };
    }

    const shipmentPackage = this.shippingProvider.buildPackage(order, cfg);
    const daneCode = input.destinationDaneCode ?? cfg.defaultDaneCode;

    const hasDane = isDane(daneCode);
    const eligibility = this.eligibility.evaluate({
      hasDane: cfg.requireDane ? hasDane : true,
      hasValidDimensions: cfg.requireDimensions ? this.shippingProvider.hasValidDimensions(shipmentPackage) : true,
      providerReady: providerCapabilities.ready,
      providerSupportsQuote: providerCapabilities.supportsQuote,
    });

    if (!eligibility.canProceed) {
      const status = eligibility.blockReason === 'missing_dane' || eligibility.blockReason === 'missing_shipping_dimensions'
        ? 'pending_address' as const
        : 'pending_provider' as const;

      await this.persistOperationalShipment(order.id, providerCapabilities.provider, status, eligibility.blockReason!, {
        autoShippingStatus: eligibility.blockReason,
        message: eligibility.blockReason === 'missing_dane'
          ? 'DANE destino requerido antes de cotizar o crear guía.'
          : eligibility.blockReason === 'missing_shipping_dimensions'
            ? 'Peso y dimensiones requeridos antes de cotizar o crear guía.'
            : undefined,
      }, input);
      return { status: eligibility.blockReason!, guideNumber: null, carrier: null };
    }

    const quoteInput = this.shippingProvider.buildQuoteInput(order, shipmentPackage, daneCode!, cfg, input);
    const quote = await this.shippingProvider.quoteShipment(quoteInput);
    const candidates = this.carrierSelection.normalizeCandidates(quote);
    const selected = this.carrierSelection.selectCheapest(candidates);

    const quotedShipment = await this.persistOperationalShipment(order.id, quote.provider, 'quoted', 'quote_created', {
      autoShippingStatus: 'quoted',
      mode: cfg.mode,
      strategy: cfg.strategy,
      quote,
      candidates,
      selectedCarrier: selected,
    }, input, selected);
    await this.shipmentEvent(quotedShipment.id, 'quoted', 'shipment.quote_created', 'Cotización automática creada después del checkout.', { candidates });
    await this.audit('AUTO_SHIPPING_QUOTED', 'shipment', quotedShipment.id, null, { orderId: order.id, candidates }, input);
    await this.publish('shipment.quote_created', order.id, { shipmentId: quotedShipment.id, orderNumber: order.orderNumber, candidates });

    if (!selected) {
      await this.failExistingShipment(quotedShipment.id, 'no_available_carrier', 'No hay transportadoras exitosas para crear guía.', input);
      return { status: 'no_available_carrier', guideNumber: null, carrier: null };
    }

    await this.shipmentEvent(quotedShipment.id, 'quoted', 'shipment.carrier_selected', `Transportadora seleccionada por menor costo: ${selected.carrier}.`, { selected });
    await this.audit('AUTO_SHIPPING_CARRIER_SELECTED', 'shipment', quotedShipment.id, null, { orderId: order.id, selected }, input);
    await this.publish('shipment.carrier_selected', order.id, { shipmentId: quotedShipment.id, orderNumber: order.orderNumber, selectedCarrier: selected.carrier });

    if (cfg.mode === 'quote_only') {
      return { status: 'quoted', guideNumber: null, carrier: selected.carrier };
    }

    const shipmentResult = await this.provider.createShipment({
      ...quoteInput,
      service: {
        ...quoteInput.service,
        carrier: selected.carrier,
        idServicio: selected.serviceId ? Number(selected.serviceId) : quoteInput.service?.idServicio ?? 1,
      },
      recipient: {
        documentType: 'CC',
        documentNumber: input.customerDocument ?? '123456789',
        firstName: order.customerName.split(' ')[0] ?? order.customerName,
        firstLastName: order.customerName.split(' ').slice(1).join(' ') || order.customerName,
        email: order.customerEmail,
      },
      observations: `Pedido ${order.orderNumber} — auto-shipping post-checkout.`,
    } as never);

    const updated = await this.prisma.shipment.update({
      where: { id: quotedShipment.id },
      data: {
        status: shipmentResult.status as PrismaShipmentStatus,
        quotedAmount: shipmentResult.quotedAmount ?? selected.quotedAmount ?? undefined,
        trackingNumber: shipmentResult.trackingNumber,
        routeNumber: shipmentResult.routeNumber,
        labelUrl: shipmentResult.labelUrl,
        providerShipmentId: shipmentResult.id,
        providerReference: selected.carrier,
        estimatedDeliveryDate: shipmentResult.estimatedDeliveryDate,
        rawProviderStatus: shipmentResult.rawStatus ?? 'guide_created',
        lastSyncAt: new Date(),
        packageSnapshot: this.mergeSnapshot(quotedShipment.packageSnapshot, {
          autoShippingStatus: 'guide_created',
          selectedCarrier: selected,
          guide: {
            guideNumber: shipmentResult.trackingNumber,
            externalShipmentId: shipmentResult.id,
            carrier: selected.carrier,
            valorFlete: shipmentResult.quotedAmount,
            routeNumber: shipmentResult.routeNumber,
            providerMessage: shipmentResult.rawStatus,
            labelStatus: shipmentResult.labelUrl ? 'generated' : 'pending_pdf',
            providerMode: shipmentResult.provider === 'mock_99envios' ? 'created_in_mock' : 'created_in_99envios_real',
          },
        }),
      },
    });
    await this.shipmentEvent(updated.id, updated.status, 'shipment.guide_created', `Guía automática creada: ${shipmentResult.trackingNumber}.`, {
      guideNumber: shipmentResult.trackingNumber,
      carrier: selected.carrier,
    });
    await this.audit('AUTO_SHIPPING_GUIDE_CREATED', 'shipment', updated.id, null, {
      orderId: order.id,
      carrier: selected.carrier,
      guideNumber: shipmentResult.trackingNumber ? '[present]' : null,
      provider: shipmentResult.provider,
    }, input);
    await this.publish('shipment.guide_created', order.id, {
      shipmentId: updated.id,
      orderNumber: order.orderNumber,
      guideNumber: shipmentResult.trackingNumber,
      carrier: selected.carrier,
    });

    return {
      status: 'guide_created',
      guideNumber: shipmentResult.trackingNumber,
      carrier: selected.carrier,
      provider: shipmentResult.provider,
    };
  }

  private async persistOperationalShipment(
    orderId: string,
    provider: string,
    status: PrismaShipmentStatus,
    rawProviderStatus: string,
    snapshot: Record<string, unknown>,
    input: AutoShippingInput,
    selected?: CarrierCandidate | null,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found for auto-shipping persistence.');
    const customer = await this.prisma.customer.upsert({
      where: { email: order.customerEmail },
      create: {
        id: uuidv7(),
        fullName: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        defaultAddress: order.shippingAddress,
        city: order.shippingCity,
      },
      update: {
        fullName: order.customerName,
        phone: order.customerPhone,
        defaultAddress: order.shippingAddress,
        city: order.shippingCity,
        lastOrderAt: order.createdAt,
      },
    });

    const existingShipment = await this.prisma.shipment.findFirst({
      where: { orderId, provider },
    });

    const shipment = existingShipment
      ? await this.prisma.shipment.update({
          where: { id: existingShipment.id },
          data: {
            status,
            quotedAmount: selected?.quotedAmount ?? undefined,
            providerReference: selected?.carrier ?? undefined,
            packageSnapshot: snapshot as Prisma.InputJsonValue,
            rawProviderStatus,
            lastSyncAt: new Date(),
          },
        })
      : await this.prisma.shipment.create({
          data: {
            id: uuidv7(),
            orderId,
            customerId: customer.id,
            provider,
            status,
            quotedAmount: selected?.quotedAmount ?? undefined,
            providerReference: selected?.carrier ?? null,
            addressSnapshot: {
              city: order.shippingCity,
              address: '[redacted]',
              daneCode: input.destinationDaneCode ?? autoConfig().defaultDaneCode ?? null,
            },
            packageSnapshot: snapshot as Prisma.InputJsonValue,
            rawProviderStatus,
            lastSyncAt: new Date(),
          },
        });

    if (autoConfig().notifyAdmin && ['missing_dane', 'missing_shipping_dimensions', 'provider_not_ready'].includes(rawProviderStatus)) {
      await this.adminNotification(orderId, rawProviderStatus, `Auto-shipping requiere atención: ${rawProviderStatus}.`);
    }

    return shipment;
  }

  private async failExistingShipment(shipmentId: string, reason: string, description: string, input: AutoShippingInput) {
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'delivery_failed',
        rawProviderStatus: reason,
        packageSnapshot: this.mergeSnapshot(undefined, { autoShippingStatus: reason, error: description }),
        lastSyncAt: new Date(),
      },
    });
    await this.shipmentEvent(shipmentId, 'delivery_failed', `shipment.${reason}`, description, { reason });
    await this.audit('AUTO_SHIPPING_FAILED', 'shipment', shipmentId, null, { reason, description }, input);
    await this.adminNotification(updated.orderId, reason, description);
    await this.publish('shipment.auto_shipping_failed', updated.orderId, { shipmentId, reason });
  }

  private async markFailure(orderId: string, reason: string, description: string, input: AutoShippingInput) {
    const provider = (await this.provider.getCapabilities().catch(() => ({ provider: process.env.SHIPPING_PROVIDER ?? 'internal' }))).provider;
    const shipment = await this.persistOperationalShipment(orderId, provider, 'delivery_failed', reason, {
      autoShippingStatus: reason,
      error: description,
    }, input);
    await this.shipmentEvent(shipment.id, 'delivery_failed', `shipment.${reason}`, description, { reason });
    await this.audit('AUTO_SHIPPING_FAILED', 'shipment', shipment.id, null, { reason, description }, input);
    await this.adminNotification(orderId, reason, description);
    await this.publish('shipment.auto_shipping_failed', orderId, { shipmentId: shipment.id, reason });
  }

  private mergeSnapshot(existing: Prisma.JsonValue | undefined, patch: Record<string, unknown>) {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? existing as Record<string, unknown>
      : {};
    return { ...base, ...patch } as Prisma.InputJsonValue;
  }

  private async shipmentEvent(shipmentId: string, status: PrismaShipmentStatus, providerStatus: string, description: string, rawPayload?: Record<string, unknown>) {
    await this.prisma.shipmentEvent.create({
      data: {
        id: uuidv7(),
        shipmentId,
        status,
        providerStatus,
        description,
        occurredAt: new Date(),
        rawPayload: rawPayload ? redactPayload(rawPayload) : Prisma.JsonNull,
      },
    });
  }

  private async audit(action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown, input: AutoShippingInput) {
    await this.prisma.auditLog.create({
      data: {
        id: uuidv7(),
        actorUserId: null,
        action,
        entityType,
        entityId,
        beforeData: redactPayload(beforeData),
        afterData: redactPayload(afterData),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  private async adminNotification(orderId: string, reason: string, message: string) {
    await this.prisma.notificationEvent.create({
      data: {
        id: uuidv7(),
        entityType: 'order',
        entityId: orderId,
        provider: 'internal',
        channel: 'internal',
        recipientMasked: 'ops@internal',
        errorCode: reason,
        errorMessage: message,
      },
    }).catch(() => undefined);
  }

  private async publish(eventName: string, orderId: string, payload: Record<string, unknown>) {
    await this.domainEventPublisher.publish({
      eventName,
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      payload: { orderId, ...payload },
    });
  }

  private safeError(error: unknown) {
    if (error instanceof Error) return error.message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email]');
    return 'Error logístico no identificado.';
  }
}
