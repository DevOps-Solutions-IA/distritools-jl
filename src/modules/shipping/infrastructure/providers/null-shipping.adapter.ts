import { ConflictException, Injectable } from '@nestjs/common';
import type {
  CreateShipmentInput,
  SchedulePickupInput,
  ShipmentQuote,
  ShipmentQuoteInput,
  ShipmentResult,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

@Injectable()
export class NullShippingAdapter implements ShippingProviderPort {
  async getCapabilities(): Promise<Awaited<ReturnType<ShippingProviderPort['getCapabilities']>>> {
    return {
      provider: 'internal' as const,
      ready: false,
      mode: 'internal' as const,
      supportsQuote: false,
      supportsCreateShipment: false,
      supportsTracking: true,
      supportsLabels: false,
      supportsPickup: false,
      supportsCashOnDelivery: false,
      supportsWallet: false,
      supportsIssues: false,
      supportsReturns: false,
      warnings: ['Transportadora externa pendiente. Se conserva tracking interno sin inventar guía.'],
    };
  }

  async getCarriers(): Promise<Awaited<ReturnType<ShippingProviderPort['getCarriers']>>> {
    return [];
  }

  async quoteShipment(_input: ShipmentQuoteInput): Promise<ShipmentQuote> {
    return {
      provider: 'internal',
      status: 'pending_provider',
      carrier: null,
      service: null,
      quotedAmount: null,
      currency: 'COP',
      estimatedDays: null,
      expiresAt: null,
      warnings: ['No hay provider logístico configurado. No se calcula tarifa externa.'],
      rawReference: null,
    };
  }

  async createShipment(_input: CreateShipmentInput): Promise<ShipmentResult> {
    return this.emptyShipment();
  }

  async getShipmentStatus(_trackingNumber: string): Promise<ShipmentResult> {
    return this.emptyShipment();
  }

  async cancelShipment(_shipmentId: string): Promise<ShipmentResult> {
    return {
      ...this.emptyShipment(),
      status: 'cancelled',
    };
  }

  async generateLabel(_shipmentId: string): Promise<{ labelUrl: string | null }> {
    return { labelUrl: null };
  }

  async schedulePickup(_input: SchedulePickupInput): Promise<Awaited<ReturnType<ShippingProviderPort['schedulePickup']>>> {
    throw new ConflictException('Shipping provider is not configured');
  }

  private emptyShipment(): ShipmentResult {
    return {
      id: null,
      provider: 'internal',
      status: 'pending_dispatch',
      quotedAmount: null,
      carrier: null,
      trackingNumber: null,
      routeNumber: null,
      labelUrl: null,
      pickupStatus: 'not_required',
      cashOnDeliveryStatus: 'not_enabled',
      estimatedDeliveryDate: null,
      rawStatus: null,
      warnings: ['Seguimiento interno disponible. Guía externa pendiente de provider real.'],
    };
  }

  async getCashOnDeliveryStatus(_shipmentId: string): Promise<Awaited<ReturnType<ShippingProviderPort['getCashOnDeliveryStatus']>>> {
    return { status: 'not_enabled' as const, amount: null };
  }

  async getWalletBalance(): Promise<Awaited<ReturnType<ShippingProviderPort['getWalletBalance']>>> {
    return {
      status: 'pending_provider' as const,
      available: null,
      pending: null,
      currency: 'COP',
    };
  }

  async getWalletTransactions(): Promise<Awaited<ReturnType<ShippingProviderPort['getWalletTransactions']>>> {
    return {
      data: [],
      operationalState: {
        status: 'pending_provider',
        message: 'Wallet pendiente de documentación/credenciales de transportadora.',
      },
    };
  }

  async getSettlements(): Promise<Awaited<ReturnType<ShippingProviderPort['getSettlements']>>> {
    return {
      data: [],
      operationalState: {
        status: 'pending_provider',
        message: 'Liquidaciones pendientes de documentación/credenciales de transportadora.',
      },
    };
  }

  async getShipmentIssues(shipmentId: string): Promise<Awaited<ReturnType<ShippingProviderPort['getShipmentIssues']>>> {
    return { data: [], shipmentId };
  }

  async resolveShipmentIssue(issueId: string): Promise<Awaited<ReturnType<ShippingProviderPort['resolveShipmentIssue']>>> {
    throw new ConflictException(`Novedad ${issueId} no puede resolverse sin provider logístico.`);
  }

  async getReturns(shipmentId: string): Promise<Awaited<ReturnType<ShippingProviderPort['getReturns']>>> {
    return { data: [], shipmentId };
  }

  async handleWebhook(): Promise<Awaited<ReturnType<ShippingProviderPort['handleWebhook']>>> {
    return {
      accepted: false,
      duplicate: false,
      eventId: null,
      eventName: null,
      externalShipmentId: null,
      status: null,
      rawStatus: null,
    };
  }
}
