import { Module } from '@nestjs/common';
import { PrismaWebhookReceiptRepository } from 'src/modules/webhooks/infrastructure/repositories/prisma-webhook-receipt.repository';
import {
  WEBHOOK_RECEIPT_REPOSITORY,
} from 'src/modules/webhooks/domain/repositories/webhook-receipt.repository';
import {
  WEBHOOK_SIGNATURE_PORT,
} from 'src/modules/webhooks/application/ports/webhook-signature.port';
import { HmacWebhookSignatureService } from 'src/modules/webhooks/infrastructure/security/hmac-webhook-signature.service';
import {
  WEBHOOK_PARSER_PORT,
} from 'src/modules/webhooks/application/ports/webhook-parser.port';
import { JsonWebhookParserService } from 'src/modules/webhooks/infrastructure/parsers/json-webhook-parser.service';
@Module({
  imports: [],
  providers: [
    PrismaWebhookReceiptRepository,
    HmacWebhookSignatureService,
    JsonWebhookParserService,
    {
      provide: WEBHOOK_RECEIPT_REPOSITORY,
      useExisting: PrismaWebhookReceiptRepository,
    },
    {
      provide: WEBHOOK_SIGNATURE_PORT,
      useExisting: HmacWebhookSignatureService,
    },
    {
      provide: WEBHOOK_PARSER_PORT,
      useExisting: JsonWebhookParserService,
    },
  ],
  exports: [
    WEBHOOK_RECEIPT_REPOSITORY,
    WEBHOOK_SIGNATURE_PORT,
    WEBHOOK_PARSER_PORT,
  ],
})
export class WebhooksModule {}
