import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  CreateShippingGuideCommand,
  ShippingDestinationInput,
  ShippingPackageInput,
  ShippingQuoteCommand,
  defaultPackage,
} from 'src/modules/shipping/application/contracts/shipping-provider.commands';
import type {
  CreateShipmentInput,
  ShipmentQuoteInput,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

@Injectable()
export class ShippingProviderInputMapper {
  normalizeDestination(
    bodyDestination: Record<string, unknown> | undefined,
    order?: { shippingCity: string; shippingAddress: string; customerName: string; customerPhone: string; shippingNotes?: string | null } | null,
  ): ShippingDestinationInput {
    const dest = bodyDestination ?? {};
    return {
      country: String(dest.country ?? 'CO'),
      department: String(dest.department ?? 'Valle del Cauca'),
      city: String(dest.city ?? order?.shippingCity ?? 'Cali'),
      daneCode: typeof dest.daneCode === 'string' ? dest.daneCode : undefined,
      addressLine1: String(dest.addressLine1 ?? order?.shippingAddress ?? 'Dirección pendiente'),
      addressLine2: typeof dest.addressLine2 === 'string' ? dest.addressLine2 : undefined,
      recipientName: String(dest.recipientName ?? order?.customerName ?? 'Cliente'),
      recipientPhone: String(dest.recipientPhone ?? order?.customerPhone ?? '3000000000'),
      notes: typeof dest.notes === 'string' ? dest.notes : order?.shippingNotes ?? undefined,
    };
  }

  normalizePackages(
    bodyPackages: Array<Record<string, unknown>> | undefined,
    order?: { orderNumber: string; grandTotal?: { toFixed?: (d: number) => string } | null } | null,
  ): ShippingPackageInput[] {
    if (bodyPackages?.length) {
      return bodyPackages.map((pkg) => ({
        weightKg: Number(pkg.weightKg ?? 1),
        lengthCm: Number(pkg.lengthCm ?? 30),
        widthCm: Number(pkg.widthCm ?? 20),
        heightCm: Number(pkg.heightCm ?? 15),
        declaredValue: String(pkg.declaredValue ?? order?.grandTotal?.toFixed?.(2) ?? '0'),
        contentDescription: String(pkg.contentDescription ?? (order ? `Pedido ${order.orderNumber}` : 'Mercancía DistriTools JL')),
      }));
    }
    return [defaultPackage(order?.orderNumber, order?.grandTotal?.toFixed?.(2) ?? '0')];
  }

  normalizeCashOnDelivery(body: Record<string, unknown> | undefined, order?: { grandTotal?: { toFixed?: (d: number) => string } | null } | null) {
    if (body?.enabled) {
      return { enabled: true, amount: String(body.amount ?? order?.grandTotal?.toFixed?.(2) ?? '0') };
    }
    return { enabled: false, amount: '0' };
  }

  buildQuoteInput(command: ShippingQuoteCommand): ShipmentQuoteInput {
    return {
      orderId: command.orderId,
      destination: command.destination as ShipmentQuoteInput['destination'],
      packages: command.packages as ShipmentQuoteInput['packages'],
      idempotencyKey: command.idempotencyKey,
      cashOnDelivery: command.cashOnDelivery,
      service: command.service,
      insurance: command.insurance,
    };
  }

  buildCreateShipmentInput(command: CreateShippingGuideCommand): CreateShipmentInput {
    return {
      ...this.buildQuoteInput(command),
      quoteReference: command.quoteReference,
      recipient: command.recipient,
      observations: command.observations,
    };
  }

  buildQuoteCommandFromOrder(body: Record<string, unknown>, orderId: string, order: {
    shippingCity: string; shippingAddress: string; customerName: string; customerPhone: string;
    shippingNotes?: string | null; orderNumber: string;
    grandTotal?: { toFixed?: (d: number) => string } | null;
  }): ShippingQuoteCommand {
    return {
      orderId,
      destination: this.normalizeDestination(body.destination as Record<string, unknown> | undefined, order),
      packages: this.normalizePackages(body.packages as Array<Record<string, unknown>> | undefined, order),
      idempotencyKey: orderId || uuidv7(),
      cashOnDelivery: this.normalizeCashOnDelivery(body.cashOnDelivery as Record<string, unknown> | undefined, order),
      service: body.service as ShippingQuoteCommand['service'] | undefined,
      insurance: body.insurance as ShippingQuoteCommand['insurance'] | undefined,
    };
  }
}
