import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from "crypto";
import { WebhookSignaturePort } from 'src/modules/webhooks/application/ports/webhook-signature.port';

@Injectable()
export class HmacWebhookSignatureService implements WebhookSignaturePort {
  verify(input: {
    gateway: string;
    signature: string | undefined;
    payload: string;
  }): boolean {
    if (!input.signature) {
      return false;
    }

    const secret = process.env.PAYMENT_GATEWAY_SECRET;

    if (!secret) {
      return false;
    }

    const expected = createHmac('sha256', secret)
      .update(`${input.gateway}.${input.payload}`)
      .digest('hex');

    const left = Buffer.from(expected, 'utf8');
    const right = Buffer.from(input.signature, 'utf8');

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  }
}
