import { Injectable } from '@nestjs/common';
import type { ShipmentQuote } from 'src/modules/shipping/application/ports/shipping-provider.port';

export interface CarrierCandidate {
  carrier: string;
  carrierLabel?: string | null;
  success?: boolean;
  message?: string | null;
  quotedAmount: string | null;
  cashOnDeliveryAmount?: string | null;
  surcharge?: string | null;
  insuranceAmount?: string | null;
  estimatedDays: number | null;
  estimatedDeliveryDate?: Date | null;
  serviceId?: string | null;
  totalComparable: number;
}

const CARRIER_PRIORITY = ['tcc', 'coordinadora', 'servientrega', 'envia', 'interrapidisimo'];

function toNumber(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class CarrierSelectionService {
  normalizeCandidates(quote: ShipmentQuote): CarrierCandidate[] {
    const source = quote.carrierOptions?.length
      ? quote.carrierOptions
      : quote.carrier
        ? [{
            carrier: quote.carrier,
            carrierLabel: quote.carrierLabel ?? quote.carrier,
            success: quote.success !== false,
            message: quote.message ?? null,
            quotedAmount: quote.quotedAmount,
            cashOnDeliveryAmount: quote.cashOnDeliveryAmount ?? null,
            surcharge: quote.surcharge ?? null,
            insuranceAmount: quote.insuranceAmount ?? null,
            estimatedDays: quote.estimatedDays,
            estimatedDeliveryDate: quote.estimatedDeliveryDate ?? null,
            serviceId: quote.service,
          }]
        : [];

    return source.map((candidate) => ({
      ...candidate,
      totalComparable:
        toNumber(candidate.quotedAmount) +
        toNumber(candidate.cashOnDeliveryAmount) +
        toNumber(candidate.surcharge) +
        toNumber(candidate.insuranceAmount),
    }));
  }

  selectCheapest(candidates: CarrierCandidate[]): CarrierCandidate | null {
    const successful = candidates.filter((c) => c.success && c.quotedAmount !== null);
    if (successful.length === 0) return null;

    return successful.sort((left, right) => {
      if (left.totalComparable !== right.totalComparable) return left.totalComparable - right.totalComparable;
      const leftDays = left.estimatedDays ?? Number.MAX_SAFE_INTEGER;
      const rightDays = right.estimatedDays ?? Number.MAX_SAFE_INTEGER;
      if (leftDays !== rightDays) return leftDays - rightDays;
      return CARRIER_PRIORITY.indexOf(left.carrier) - CARRIER_PRIORITY.indexOf(right.carrier);
    })[0];
  }
}
