import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';
import { MockEmailProvider } from 'src/modules/notifications/infrastructure/providers/mock-email.provider';
import { MockWhatsAppProvider } from 'src/modules/notifications/infrastructure/providers/mock-whatsapp.provider';

test('mock notification providers fail closed in production and staging without producing sent results', async () => {
  const env = { ...process.env };
  const outbox = await mkdtemp(path.join(tmpdir(), 'ex072-email-outbox-'));

  try {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_PROVIDER;
    process.env.LOCAL_EMAIL_OUTBOX_DIR = outbox;

    await assert.rejects(
      new MockEmailProvider().send({ to: 'customer@example.test', subject: 'test', content: 'test' }),
      (error: unknown) => error instanceof NotificationDeliveryError && error.safeCode === 'PROVIDER_BLOCKED',
    );
    await assert.rejects(
      new MockWhatsAppProvider().send({ to: '+573001234567', content: 'test' }),
      (error: unknown) => error instanceof NotificationDeliveryError && error.safeCode === 'PROVIDER_BLOCKED',
    );
    assert.deepEqual(await readdir(outbox), []);

    process.env.APP_ENV = 'staging';
    process.env.NODE_ENV = 'test';
    await assert.rejects(
      new MockEmailProvider().send({ to: 'customer@example.test', subject: 'test', content: 'test' }),
      (error: unknown) => error instanceof NotificationDeliveryError && error.safeCode === 'PROVIDER_BLOCKED',
    );

    process.env.APP_ENV = 'local';
    process.env.NODE_ENV = 'PrOd';
    await assert.rejects(
      new MockWhatsAppProvider().send({ to: '+573001234567', content: 'test' }),
      (error: unknown) => error instanceof NotificationDeliveryError && error.safeCode === 'PROVIDER_BLOCKED',
    );

    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    const email = await new MockEmailProvider().send({ to: 'customer@example.test', subject: 'test', content: 'test' });
    const whatsapp = await new MockWhatsAppProvider().send({ to: '+573001234567', content: 'test' });
    assert.match(email.providerMessageId, /^local-file-email-/);
    assert.match(whatsapp.providerMessageId, /^wa-/);
    assert.equal((await readdir(outbox)).length, 1);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in env)) delete process.env[key];
    }
    Object.assign(process.env, env);
    await rm(outbox, { recursive: true, force: true });
  }
});
