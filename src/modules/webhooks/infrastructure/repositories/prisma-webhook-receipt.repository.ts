import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateWebhookReceiptRecord,
  WebhookReceiptRepository,
} from 'src/modules/webhooks/domain/repositories/webhook-receipt.repository';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaWebhookReceiptRepository implements WebhookReceiptRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByGatewayAndEventId(
    tx: PrismaTransactionClient,
    gateway: string,
    externalEventId: string,
  ) {
    return tx.webhookReceipt.findUnique({
      where: {
        gateway_externalEventId: {
          gateway,
          externalEventId,
        },
      },
    });
  }

  async createIfAbsent(
    tx: PrismaTransactionClient,
    data: CreateWebhookReceiptRecord,
  ) {
    const result = await tx.webhookReceipt.createMany({
      data: [
        {
          id: data.id,
          gateway: data.gateway,
          externalEventId: data.externalEventId,
          signature: data.signature,
          payload: data.payload as never,
        },
      ],
      skipDuplicates: true,
    });

    const receipt = await tx.webhookReceipt.findUniqueOrThrow({
      where: {
        gateway_externalEventId: {
          gateway: data.gateway,
          externalEventId: data.externalEventId,
        },
      },
    });

    return {
      receipt,
      inserted: result.count > 0,
    };
  }

  async markProcessed(tx: PrismaTransactionClient, id: string) {
    return tx.webhookReceipt.update({
      where: { id },
      data: {
        processedAt: new Date(),
      },
    });
  }
}
