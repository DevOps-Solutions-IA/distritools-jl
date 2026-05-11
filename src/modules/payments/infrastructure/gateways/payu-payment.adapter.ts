import { ConflictException, Injectable } from '@nestjs/common';
import { NullPaymentAdapter } from 'src/modules/payments/infrastructure/gateways/null-payment.adapter';
import type {
  CreateProviderPaymentIntentInput,
  ProviderPaymentIntent,
} from 'src/modules/payments/application/ports/payment-provider.port';

@Injectable()
export class PayUPaymentAdapter extends NullPaymentAdapter {
  override async createPaymentIntent(
    _input: CreateProviderPaymentIntentInput,
  ): Promise<ProviderPaymentIntent> {
    throw new ConflictException('PayU PSE provider credentials are not configured');
  }
}
