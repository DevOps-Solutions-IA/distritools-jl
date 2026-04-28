import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  WhatsAppProviderPort,
  WhatsAppProviderSendInput,
} from 'src/modules/notifications/application/ports/whatsapp-provider.port';

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProviderPort {
  async send(
    input: WhatsAppProviderSendInput,
  ): Promise<{ providerMessageId: string }> {
    if (input.to.includes('fail-wa')) {
      throw new Error('Mock whatsapp delivery failure');
    }

    return {
      providerMessageId: `wa-${uuidv7()}`,
    };
  }
}
