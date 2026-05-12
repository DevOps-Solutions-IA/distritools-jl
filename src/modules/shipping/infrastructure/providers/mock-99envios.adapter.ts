import { ConflictException, Injectable } from '@nestjs/common';
import type {
  CreateShipmentInput,
  SchedulePickupInput,
  ShipmentQuote,
  ShipmentQuoteInput,
  ShipmentResult,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

function assertMockAllowed() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_MOCK_99ENVIOS_IN_PRODUCTION !== 'true'
  ) {
    throw new ConflictException('mock_99envios no está permitido como provider real en producción.');
  }
}

@Injectable()
export class Mock99EnviosAdapter implements ShippingProviderPort {
  async getCapabilities() {
    return {
      provider: 'mock_99envios' as const,
      ready: process.env.NODE_ENV !== 'production',
      mode: 'mock' as const,
      supportsQuote: true,
      supportsCreateShipment: true,
      supportsTracking: true,
      supportsLabels: true,
      supportsPickup: true,
      supportsCashOnDelivery: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true',
      supportsWallet: true,
      supportsIssues: true,
      supportsReturns: true,
      warnings: ['Mock local/test. No representa guía, tarifa ni tracking productivo de 99 Envíos.'],
    };
  }

  async getCarriers() {
    return [
      {
        id: 'mock-99envios-standard',
        name: '99 Envíos Mock Standard',
        services: ['standard', 'contraentrega_mock'],
      },
    ];
  }

  async quoteShipment(input: ShipmentQuoteInput): Promise<ShipmentQuote> {
    assertMockAllowed();
    const packageCount = Math.max(input.packages.length, 1);
    const quotedAmount = String(8900 + packageCount * 3500);

    return {
      provider: 'mock_99envios',
      status: 'quoted',
      carrier: '99 Envíos Mock',
      service: input.cashOnDelivery?.enabled ? 'standard_cod_mock' : 'standard_mock',
      quotedAmount,
      currency: 'COP',
      estimatedDays: 2,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      warnings: ['Cotización mock local/test. No usar como tarifa productiva.'],
      rawReference: {
        mock: true,
        packageCount,
        cod: Boolean(input.cashOnDelivery?.enabled),
      },
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    assertMockAllowed();
    const suffix = input.idempotencyKey.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();

    return {
      id: `mock99-${suffix}`,
      provider: 'mock_99envios',
      status: 'guide_generated',
      quotedAmount: '12400',
      carrier: '99 Envíos Mock',
      trackingNumber: `MOCK99-${suffix}`,
      routeNumber: `RUTA-MOCK-${suffix}`,
      labelUrl: `https://mock.local/99envios/labels/${suffix}.pdf`,
      pickupStatus: 'pending',
      cashOnDeliveryStatus: input.cashOnDelivery?.enabled ? 'pending' : 'not_enabled',
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      rawStatus: 'created',
      warnings: ['Guía mock local/test. No es guía externa real.'],
    };
  }

  async getShipmentStatus(trackingNumber: string): Promise<ShipmentResult> {
    assertMockAllowed();
    return {
      id: trackingNumber,
      provider: 'mock_99envios',
      status: 'in_transit',
      quotedAmount: null,
      carrier: '99 Envíos Mock',
      trackingNumber,
      routeNumber: null,
      labelUrl: null,
      pickupStatus: 'picked_up',
      cashOnDeliveryStatus: 'pending',
      estimatedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      rawStatus: 'in_transit',
      warnings: ['Tracking mock local/test.'],
    };
  }

  async cancelShipment(shipmentId: string): Promise<ShipmentResult> {
    assertMockAllowed();
    return {
      id: shipmentId,
      provider: 'mock_99envios',
      status: 'cancelled',
      quotedAmount: null,
      carrier: '99 Envíos Mock',
      trackingNumber: null,
      routeNumber: null,
      labelUrl: null,
      pickupStatus: 'cancelled',
      cashOnDeliveryStatus: 'not_enabled',
      estimatedDeliveryDate: null,
      rawStatus: 'cancelled',
      warnings: ['Cancelación mock local/test.'],
    };
  }

  async generateLabel(shipmentId: string) {
    assertMockAllowed();
    return { labelUrl: `https://mock.local/99envios/labels/${shipmentId}.pdf` };
  }

  async schedulePickup(_input: SchedulePickupInput) {
    assertMockAllowed();
    return { pickupStatus: 'scheduled' as const };
  }

  async getCashOnDeliveryStatus(_shipmentId: string) {
    return {
      status: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true' ? 'pending' as const : 'not_enabled' as const,
      amount: null,
    };
  }

  async getWalletBalance() {
    return { status: 'available' as const, available: '0', pending: '0', currency: 'COP' };
  }

  async getWalletTransactions() {
    return { data: [] };
  }

  async getSettlements() {
    return { data: [] };
  }

  async getShipmentIssues(shipmentId: string) {
    return { shipmentId, data: [] };
  }

  async resolveShipmentIssue(issueId: string) {
    return { id: issueId, status: 'resolved_mock' };
  }

  async getReturns(shipmentId: string) {
    return { shipmentId, data: [] };
  }

  async handleWebhook(input: { body: unknown }) {
    const body = input.body as Record<string, unknown>;
    const rawStatus = typeof body.status === 'string' ? body.status : null;
    return {
      accepted: true,
      duplicate: false,
      eventId: typeof body.eventId === 'string' ? body.eventId : null,
      eventName: typeof body.eventName === 'string' ? body.eventName : 'shipment.updated',
      externalShipmentId: typeof body.externalShipmentId === 'string' ? body.externalShipmentId : null,
      status: rawStatus === 'delivered' ? 'delivered' as const : 'in_transit' as const,
      rawStatus,
    };
  }
}
