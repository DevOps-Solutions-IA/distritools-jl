import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';
import {
  EmailProviderPort,
  EmailProviderSendInput,
} from 'src/modules/notifications/application/ports/email-provider.port';

@Injectable()
export class MockEmailProvider implements EmailProviderPort {
  async send(input: EmailProviderSendInput): Promise<{ providerMessageId: string }> {
    const provider = process.env.EMAIL_PROVIDER ?? 'local-file';
    if (process.env.NODE_ENV === 'production' && provider === 'none') {
      throw new Error('Email provider not configured for production');
    }

    if (input.to.includes('fail-email')) {
      throw new NotificationDeliveryError('MOCK_EMAIL_NOT_SENT');
    }

    const providerMessageId = `local-file-email-${uuidv7()}`;
    const outboxDir = process.env.LOCAL_EMAIL_OUTBOX_DIR ?? '/tmp/distritools-emails';
    await mkdir(outboxDir, { recursive: true });
    await writeFile(
      join(outboxDir, `${providerMessageId}.json`),
      JSON.stringify(
        {
          provider,
          to: input.to,
          subject: input.subject,
          content: input.content,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );

    return {
      providerMessageId,
    };
  }
}
