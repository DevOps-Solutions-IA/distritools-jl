import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationEntity } from 'src/modules/notifications/domain/entities/notification.entity';

describe('NotificationEntity admin response', () => {
  it('returns an operational allowlist and omits message, provider and payload secrets', () => {
    const response = NotificationEntity.fromState({
      id: 'notification-1',
      eventId: 'event-1',
      eventName: 'order.created',
      channel: 'email',
      recipient: 'private@example.com',
      subject: 'Order for private@example.com',
      content: 'Customer address: Calle 10 # 20-30, token=secret-value',
      provider: 'local',
      status: 'failed',
      providerMessageId: 'provider-private-id',
      attempts: 2,
      lastError: 'request to provider failed for private@example.com with bearer secret-value',
      payload: { email: 'private@example.com', nested: { apiToken: 'secret-value' } },
      sentAt: null,
      failedAt: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    }).toResponse();

    assert.deepEqual(response, {
      id: 'notification-1',
      eventName: 'order.created',
      channel: 'email',
      recipient: 'pr***@example.com',
      subject: '[PROTECTED]',
      provider: 'local',
      status: 'failed',
      attempts: 2,
      lastError: '[DETAILS_REDACTED]',
      sentAt: null,
      failedAt: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    assert.equal(JSON.stringify(response).includes('secret-value'), false);
    assert.equal(JSON.stringify(response).includes('private@example.com'), false);
    assert.equal(JSON.stringify(response).includes('Calle 10'), false);
  });
});
