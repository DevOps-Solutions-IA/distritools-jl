import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  EmailProviderPort,
  EmailProviderSendInput,
} from 'src/modules/notifications/application/ports/email-provider.port';

@Injectable()
export class MockEmailProvider implements EmailProviderPort {
  async send(input: EmailProviderSendInput): Promise<{ providerMessageId: string }> {
    if (input.to.includes('fail-email')) {
      throw new Error('Mock email delivery failure');
    }

    return {
      providerMessageId: `email-${uuidv7()}`,
    };
  }
}
