import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { JsonWebhookParserService } from 'src/modules/webhooks/infrastructure/parsers/json-webhook-parser.service';

describe('JsonWebhookParserService', () => {
  const parser = new JsonWebhookParserService();

  it('accepts only complete, supported payment event contracts', () => {
    assert.deepEqual(
      parser.parse('mock', JSON.stringify({
        eventId: 'evt-1', gatewayReference: 'mock-ref-1', status: 'approved',
      })),
      {
        externalEventId: 'evt-1',
        gatewayReference: 'mock-ref-1',
        transactionId: undefined,
        status: 'approved',
        rawPayload: { eventId: 'evt-1', gatewayReference: 'mock-ref-1', status: 'approved' },
      },
    );
  });

  it('rejects unknown payment outcomes instead of coercing them to rejected', () => {
    assert.throws(
      () => parser.parse('mock', JSON.stringify({
        eventId: 'evt-2', gatewayReference: 'mock-ref-2', status: 'chargeback',
      })),
      BadRequestException,
    );
  });

  it('rejects missing, blank, and incorrectly typed event identity fields', () => {
    for (const payload of [
      { gatewayReference: 'mock-ref', status: 'approved' },
      { eventId: ' ', gatewayReference: 'mock-ref', status: 'approved' },
      { eventId: 'evt', gatewayReference: 7, status: 'approved' },
    ]) {
      assert.throws(
        () => parser.parse('mock', JSON.stringify(payload)),
        BadRequestException,
      );
    }
  });

  it('rejects invalid JSON as a client contract error', () => {
    assert.throws(() => parser.parse('mock', '{'), BadRequestException);
  });
});
