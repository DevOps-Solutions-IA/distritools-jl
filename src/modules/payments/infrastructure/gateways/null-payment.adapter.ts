import { ConflictException, Injectable } from '@nestjs/common';
import type {
  CreateProviderPaymentIntentInput,
  PaymentProviderPort,
  ProviderPaymentIntent,
  ProviderPaymentStatus,
  ProviderWebhookResult,
  RefundPaymentInput,
} from 'src/modules/payments/application/ports/payment-provider.port';

@Injectable()
export class NullPaymentAdapter implements PaymentProviderPort {
  async createPaymentIntent(
    _input: CreateProviderPaymentIntentInput,
  ): Promise<ProviderPaymentIntent> {
    throw new ConflictException('Payment provider is not configured');
  }

  async getPaymentStatus(providerReference: string): Promise<ProviderPaymentStatus> {
    return {
      provider: 'none',
      providerReference,
      status: 'pending_confirmation',
    };
  }

  async handleWebhook(): Promise<ProviderWebhookResult> {
    throw new ConflictException('Payment provider webhook is not configured');
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderPaymentStatus> {
    return {
      provider: 'none',
      providerReference: input.providerReference,
      status: 'pending_confirmation',
    };
  }
}
