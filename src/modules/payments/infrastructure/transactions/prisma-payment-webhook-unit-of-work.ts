import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import type { PaymentWebhookUnitOfWork } from 'src/modules/payments/application/ports/payment-webhook-unit-of-work.port';

@Injectable()
export class PrismaPaymentWebhookUnitOfWork implements PaymentWebhookUnitOfWork {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  run<T>(operation: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation, {
      maxWait: 15000,
      timeout: 30000,
    });
  }
}
