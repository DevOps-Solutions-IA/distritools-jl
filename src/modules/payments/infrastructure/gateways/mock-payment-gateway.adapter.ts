import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  CreatePaymentIntentPayload,
  PaymentGatewayPort,
} from 'src/modules/payments/application/ports/payment-gateway.port';

@Injectable()
export class MockPaymentGatewayAdapter implements PaymentGatewayPort {
  async createIntent(payload: CreatePaymentIntentPayload) {
    const gatewayReference = `mock-${uuidv7()}`;

    return {
      gatewayReference,
      checkoutUrl: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/checkout/${payload.orderId}?payment=${gatewayReference}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }
}
