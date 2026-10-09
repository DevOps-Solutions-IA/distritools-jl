import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { Request } from 'express';
import { PaymentsController } from 'src/modules/payments/infrastructure/http/controllers/payments.controller';
import { ProcessPaymentWebhookUseCase } from 'src/modules/payments/application/use-cases/process-payment-webhook.use-case';

describe('PaymentsController raw webhook body', () => {
  it('rejects a missing raw body rather than reconstructing signed bytes from parsed JSON', async () => {
    let invoked = false;
    const controller = new PaymentsController(
      {} as never,
      {} as never,
      { execute: async () => { invoked = true; } } as unknown as ProcessPaymentWebhookUseCase,
    );

    assert.throws(
      () => controller.processWebhook('mock', 'signature', { rawBody: undefined } as never as Request & { rawBody?: Buffer }),
      (error: unknown) => error instanceof BadRequestException,
    );
    assert.equal(invoked, false);
  });
});
