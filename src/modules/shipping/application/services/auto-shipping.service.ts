import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SHIPPING_PROVIDER_PORT,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';
import { AutoShippingEligibilityService } from 'src/modules/shipping/application/services/auto-shipping-eligibility.service';
import { AutoShippingInfraService, mergeJsonSnapshot, safeError as safeErrorMessage } from 'src/modules/shipping/application/services/auto-shipping-infra.service';
import { AutoShippingProviderService } from 'src/modules/shipping/application/services/auto-shipping-provider.service';
import { CarrierSelectionService, CarrierCandidate } from 'src/modules/shipping/application/services/carrier-selection.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import type { PersistedDomainEvent } from 'src/common/events/domain-event-outbox.port';

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

@Injectable()
export class AutoShippingService {
  private readonly logger = new Logger(AutoShippingService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER_PORT)
    private readonly provider: ShippingProviderPort,
    @Inject(AutoShippingEligibilityService)
    private readonly eligibility: AutoShippingEligibilityService,
    @Inject(CarrierSelectionService)
    private readonly carrierSelection: CarrierSelectionService,
    @Inject(AutoShippingProviderService)
    private readonly shippingProvider: AutoShippingProviderService,
    @Inject(AutoShippingInfraService)
    private readonly infra: AutoShippingInfraService,
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
      this.logger.warn(`Auto-shipping failed safely for order ${input.orderId}: ${safeErrorMessage(error)}`);
      await this.markFailure(input.orderId, 'auto_shipping_failed', safeErrorMessage(error), input);
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

    const { shipment: quotedShipment, event: quoteEvent } = await this.persistOperationalShipment(order.id, quote.provider, 'quoted', 'quote_created', {
      autoShippingStatus: 'quoted',
      mode: cfg.mode,
      strategy: cfg.strategy,
      quote,
      candidates,
      selectedCarrier: selected,
    }, input, selected, {
      eventName: 'shipment.quote_created',
      orderId: order.id,
      payload: { shipmentId: 'created-in-transaction', orderNumber: order.orderNumber, candidates },
      shipmentEvent: { status: 'quoted', providerStatus: 'shipment.quote_created', description: 'Cotización automática creada después del checkout.', rawPayload: { candidates } },
    });
    await this.infra.audit('AUTO_SHIPPING_QUOTED', 'shipment', quotedShipment.id, null, { orderId: order.id, candidates }, input.ipAddress, input.userAgent);
    if (quoteEvent) await this.infra.publish(quoteEvent);

    if (!selected) {
      await this.failExistingShipment(quotedShipment.id, 'no_available_carrier', 'No hay transportadoras exitosas para crear guía.', input);
      return { status: 'no_available_carrier', guideNumber: null, carrier: null };
    }

    const carrierSelectedEvent = await this.prisma.$transaction(async (tx) => {
      await tx.shipmentEvent.create({ data: {
        id: uuidv7(), shipmentId: quotedShipment.id, status: 'quoted', providerStatus: 'shipment.carrier_selected',
        description: `Transportadora seleccionada por menor costo: ${selected.carrier}.`, occurredAt: new Date(),
        rawPayload: { selected } as unknown as Prisma.InputJsonValue,
      } });
      return this.infra.capture(tx as PrismaTransactionClient, 'shipment.carrier_selected', order.id, {
        shipmentId: quotedShipment.id, orderNumber: order.orderNumber, selectedCarrier: selected.carrier,
      });
    });
    await this.infra.audit('AUTO_SHIPPING_CARRIER_SELECTED', 'shipment', quotedShipment.id, null, { orderId: order.id, selected }, input.ipAddress, input.userAgent);
    await this.infra.publish(carrierSelectedEvent);

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

    const { updated, guideEvent } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
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
        packageSnapshot: mergeJsonSnapshot(quotedShipment.packageSnapshot, {
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
      await tx.shipmentEvent.create({ data: {
        id: uuidv7(), shipmentId: updated.id, status: updated.status,
        providerStatus: 'shipment.guide_created', description: `Guía automática creada: ${shipmentResult.trackingNumber}.`,
        occurredAt: new Date(), rawPayload: { guideNumber: shipmentResult.trackingNumber, carrier: selected.carrier } as Prisma.InputJsonValue,
      } });
      const guideEvent = await this.infra.capture(tx as PrismaTransactionClient, 'shipment.guide_created', order.id, {
        shipmentId: updated.id, orderNumber: order.orderNumber,
        guideNumber: shipmentResult.trackingNumber, carrier: selected.carrier,
      });
      return { updated, guideEvent };
    });
    await this.infra.audit('AUTO_SHIPPING_GUIDE_CREATED', 'shipment', updated.id, null, {
      orderId: order.id,
      carrier: selected.carrier,
      guideNumber: shipmentResult.trackingNumber ? '[present]' : null,
      provider: shipmentResult.provider,
    }, input.ipAddress, input.userAgent);
    await this.infra.publish(guideEvent);

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
    capture?: {
      eventName: 'shipment.quote_created' | 'shipment.auto_shipping_failed';
      orderId: string;
      payload: Record<string, unknown>;
      shipmentEvent: { status: PrismaShipmentStatus; providerStatus: string; description: string; rawPayload?: Record<string, unknown> };
    },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found for auto-shipping persistence.');
    const { shipment, event } = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: order.customerEmail },
        create: {
          id: uuidv7(), fullName: order.customerName, email: order.customerEmail, phone: order.customerPhone,
          defaultAddress: order.shippingAddress, city: order.shippingCity,
        },
        update: {
          fullName: order.customerName, phone: order.customerPhone, defaultAddress: order.shippingAddress,
          city: order.shippingCity, lastOrderAt: order.createdAt,
        },
      });
      const existingShipment = await tx.shipment.findFirst({ where: { orderId, provider } });
      const shipment = existingShipment
        ? await tx.shipment.update({
            where: { id: existingShipment.id },
            data: {
              status, quotedAmount: selected?.quotedAmount ?? undefined,
              providerReference: selected?.carrier ?? undefined,
              packageSnapshot: snapshot as Prisma.InputJsonValue, rawProviderStatus, lastSyncAt: new Date(),
            },
          })
        : await tx.shipment.create({
            data: {
              id: uuidv7(), orderId, customerId: customer.id, provider, status,
              quotedAmount: selected?.quotedAmount ?? undefined, providerReference: selected?.carrier ?? null,
              addressSnapshot: {
                city: order.shippingCity, address: '[redacted]',
                daneCode: input.destinationDaneCode ?? autoConfig().defaultDaneCode ?? null,
              },
              packageSnapshot: snapshot as Prisma.InputJsonValue, rawProviderStatus, lastSyncAt: new Date(),
            },
          });
      let event: PersistedDomainEvent | null = null;
      if (capture) {
        const payload = { ...capture.payload, shipmentId: shipment.id };
        await tx.shipmentEvent.create({ data: {
          id: uuidv7(), shipmentId: shipment.id, status: capture.shipmentEvent.status,
          providerStatus: capture.shipmentEvent.providerStatus, description: capture.shipmentEvent.description,
          occurredAt: new Date(), rawPayload: capture.shipmentEvent.rawPayload
            ? capture.shipmentEvent.rawPayload as Prisma.InputJsonValue : Prisma.JsonNull,
        } });
        event = await this.infra.capture(tx as PrismaTransactionClient, capture.eventName, capture.orderId, payload as never);
      }
      return { shipment, event };
    });

    if (autoConfig().notifyAdmin && ['missing_dane', 'missing_shipping_dimensions', 'provider_not_ready'].includes(rawProviderStatus)) {
      await this.infra.adminNotification(orderId, rawProviderStatus, `Auto-shipping requiere atención: ${rawProviderStatus}.`);
    }

    return { shipment, event };
  }

  private async failExistingShipment(shipmentId: string, reason: string, description: string, input: AutoShippingInput) {
    const { updated, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
        status: 'delivery_failed',
        rawProviderStatus: reason,
        packageSnapshot: mergeJsonSnapshot(undefined, { autoShippingStatus: reason, error: description }),
        lastSyncAt: new Date(),
        },
      });
      await tx.shipmentEvent.create({ data: {
        id: uuidv7(), shipmentId, status: 'delivery_failed', providerStatus: `shipment.${reason}`,
        description, occurredAt: new Date(), rawPayload: { reason },
      } });
      const event = await this.infra.capture(tx as PrismaTransactionClient, 'shipment.auto_shipping_failed', updated.orderId, {
        shipmentId, reason,
      });
      return { updated, event };
    });
    await this.infra.audit('AUTO_SHIPPING_FAILED', 'shipment', shipmentId, null, { reason, description }, input.ipAddress, input.userAgent);
    await this.infra.adminNotification(updated.orderId, reason, description);
    await this.infra.publish(event);
  }

  private async markFailure(orderId: string, reason: string, description: string, input: AutoShippingInput) {
    const provider = (await this.provider.getCapabilities().catch(() => ({ provider: process.env.SHIPPING_PROVIDER ?? 'internal' }))).provider;
    const { shipment, event } = await this.persistOperationalShipment(orderId, provider, 'delivery_failed', reason, {
      autoShippingStatus: reason,
      error: description,
    }, input, undefined, {
      eventName: 'shipment.auto_shipping_failed', orderId,
      payload: { shipmentId: 'created-in-transaction', reason },
      shipmentEvent: { status: 'delivery_failed', providerStatus: `shipment.${reason}`, description, rawPayload: { reason } },
    });
    await this.infra.audit('AUTO_SHIPPING_FAILED', 'shipment', shipment.id, null, { reason, description }, input.ipAddress, input.userAgent);
    await this.infra.adminNotification(orderId, reason, description);
    if (event) await this.infra.publish(event);
  }

}
