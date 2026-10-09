import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  WhatsAppProviderPort,
  WhatsAppProviderSendInput,
} from 'src/modules/notifications/application/ports/whatsapp-provider.port';
import { assertMockNotificationProviderAllowed } from 'src/modules/notifications/infrastructure/providers/mock-provider-safety';

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProviderPort {
  async send(
    input: WhatsAppProviderSendInput,
  ): Promise<{ providerMessageId: string }> {
    assertMockNotificationProviderAllowed();
    if (input.to.includes('fail-wa')) {
      throw new Error('Mock whatsapp delivery failure');
    }

    return {
      providerMessageId: `wa-${uuidv7()}`,
    };
  }
}
