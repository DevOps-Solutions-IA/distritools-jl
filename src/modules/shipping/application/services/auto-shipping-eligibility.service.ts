import { Injectable } from '@nestjs/common';

export interface AutoShippingEligibilityInput {
  hasDane: boolean;
  hasValidDimensions: boolean;
  providerReady: boolean;
  providerSupportsQuote: boolean;
}

export interface AutoShippingEligibilityResult {
  canProceed: boolean;
  blockReason: 'missing_dane' | 'missing_shipping_dimensions' | 'provider_not_ready' | null;
}

@Injectable()
export class AutoShippingEligibilityService {
  evaluate(input: AutoShippingEligibilityInput): AutoShippingEligibilityResult {
    if (!input.hasDane) {
      return { canProceed: false, blockReason: 'missing_dane' };
    }

    if (!input.hasValidDimensions) {
      return { canProceed: false, blockReason: 'missing_shipping_dimensions' };
    }

    if (!input.providerReady || !input.providerSupportsQuote) {
      return { canProceed: false, blockReason: 'provider_not_ready' };
    }

    return { canProceed: true, blockReason: null };
  }
}
