import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SHIPPING_PROVIDER_PORT,
  ShippingProviderPort,
  ShipmentPackage,
  ShipmentQuoteInput,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

type OrderForProvider = Prisma.OrderGetPayload<{
  include: { orderItems: { include: { variant: { include: { product: true } } } }; shipments: true };
}>;

export interface AutoShippingConfig {
  defaultDepartment: string;
  defaultWeightKg: number;
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
}

export interface ProviderPayloadInput {
  paymentMethod?: string;
}

@Injectable()
export class AutoShippingProviderService {
  constructor(
    @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort,
  ) {}

  async fetchCapabilities() {
    return this.provider.getCapabilities();
  }

  buildPackage(order: OrderForProvider, cfg: AutoShippingConfig): ShipmentPackage {
    const content = order.orderItems
      .map((item) => `${item.quantity}x ${item.variantNameSnapshot}`)
      .join(', ')
      .slice(0, 190);
    return {
      weightKg: cfg.defaultWeightKg,
      lengthCm: cfg.defaultLengthCm,
      widthCm: cfg.defaultWidthCm,
      heightCm: cfg.defaultHeightCm,
      declaredValue: order.grandTotal.toFixed(2),
      contentDescription: content || 'Herramientas',
    };
  }

  hasValidDimensions(pkg: ShipmentPackage): boolean {
    return pkg.weightKg > 0 && pkg.lengthCm > 0 && pkg.widthCm > 0 && pkg.heightCm > 0;
  }

  buildQuoteInput(
    order: OrderForProvider,
    shipmentPackage: ShipmentPackage,
    daneCode: string,
    cfg: AutoShippingConfig,
    input: ProviderPayloadInput,
  ): ShipmentQuoteInput {
    return {
      orderId: order.id,
      destination: {
        country: 'CO',
        department: cfg.defaultDepartment,
        city: order.shippingCity,
        daneCode,
        addressLine1: order.shippingAddress,
        recipientName: order.customerName,
        recipientPhone: order.customerPhone,
        notes: order.shippingNotes ?? undefined,
      },
      packages: [shipmentPackage],
      idempotencyKey: `auto-shipping:${order.id}`,
      cashOnDelivery: {
        enabled: input.paymentMethod === 'cash_on_delivery',
        amount: order.grandTotal.toFixed(2),
      },
      service: { idTipoEntrega: 1, idServicio: 1, country: 'colombia', creationOrigin: 1 },
    };
  }

  async quoteShipment(quoteInput: ShipmentQuoteInput) {
    return this.provider.quoteShipment(quoteInput);
  }

  async createShipment(createInput: ShipmentQuoteInput & { service?: Record<string, unknown>; carrier?: string; serviceId?: string | null }) {
    return this.provider.createShipment({
      ...createInput,
      service: {
        ...createInput.service,
        carrier: createInput.carrier,
        idServicio: createInput.serviceId ? Number(createInput.serviceId) : (createInput.service as Record<string, unknown>)?.idServicio as number ?? 1,
      },
    } as never);
  }
}
