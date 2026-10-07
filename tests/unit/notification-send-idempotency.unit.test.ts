import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';
import { SendNotificationUseCase } from 'src/modules/notifications/application/use-cases/send-notification.use-case';

function makeHarness(providerSend: () => Promise<{ providerMessageId: string }>) {
  let status = 'queued';
  let attempts = 0;
  let sends = 0;
  let auditFailures = 0;
  let auditIntents = 0;
  let recordedAudits = 0;
  const repository = {
    findById: async () => ({
      id: '0199a001-0000-7000-8000-000000000002', eventId: '0199a001-0000-7000-8000-000000000001',
      channel: 'email', recipient: 'masked@example.test', subject: 'test', content: 'test', status,
    }),
    claimForSend: async () => {
      if (status !== 'queued' && status !== 'failed') return null;
      status = 'sending'; attempts += 1;
      return { claimToken: `claim-${attempts}` };
    },
    markSentWithClaim: async () => { status = 'sent'; auditIntents += 1; return true; },
    markFailedWithClaim: async () => { if (status !== 'sending') return false; status = 'failed'; auditIntents += 1; return true; },
    markUncertainWithClaim: async () => { if (status !== 'sending') return false; status = 'uncertain'; auditIntents += 1; return true; },
    flushAuditIntents: async () => {
      if (auditIntents && auditFailures) { auditFailures -= 1; throw new Error('AUDIT_UNAVAILABLE'); }
      const count = auditIntents; recordedAudits += count; auditIntents = 0; return count;
    },
  };
  const useCase = new SendNotificationUseCase(
    repository as never,
    { send: async () => { sends += 1; return providerSend(); } } as never,
    { send: async () => ({ providerMessageId: 'unused' }) } as never,
  );
  return {
    useCase, get status() { return status; }, get attempts() { return attempts; }, get sends() { return sends; },
    failNextAudit: () => { auditFailures += 1; },
    recoverStale: () => { status = 'uncertain'; auditIntents += 1; },
    get recordedAudits() { return recordedAudits; },
  };
}

describe('notification send idempotency', () => {
  it('marks ambiguous provider timeout uncertain and never retries it blindly', async () => {
    const harness = makeHarness(async () => { throw new Error('provider accepted then timed out with PII'); });
    await harness.useCase.execute('0199a001-0000-7000-8000-000000000002');
    await harness.useCase.execute('0199a001-0000-7000-8000-000000000002');
    assert.equal(harness.status, 'uncertain');
    assert.equal(harness.sends, 1);
    assert.equal(harness.attempts, 1);
  });

  it('keeps explicitly not-sent mock failures retryable without storing the raw error', async () => {
    const harness = makeHarness(async () => { throw new NotificationDeliveryError('MOCK_EMAIL_NOT_SENT'); });
    await assert.rejects(harness.useCase.execute('0199a001-0000-7000-8000-000000000002'), NotificationDeliveryError);
    assert.equal(harness.status, 'failed');
    assert.equal(harness.sends, 1);
  });

  it('repairs a sent audit on retry without another provider call', async () => {
    const harness = makeHarness(async () => ({ providerMessageId: 'mock' }));
    harness.failNextAudit();
    await harness.useCase.execute('id');
    assert.equal(harness.status, 'sent');
    await harness.useCase.execute('id');
    await harness.useCase.execute('id');
    assert.equal(harness.sends, 1);
    assert.equal(harness.recordedAudits, 1);
  });

  it('does not claim a failed transition after a recoverer fenced the sender', async () => {
    const harness = makeHarness(async () => {
      harness.recoverStale();
      throw new NotificationDeliveryError('MOCK_EMAIL_NOT_SENT');
    });
    await harness.useCase.execute('id');
    assert.equal(harness.status, 'uncertain');
    assert.equal(harness.recordedAudits, 1);
  });
});
