import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import type { CancelOrderUnitOfWork } from 'src/modules/orders/application/ports/cancel-order-unit-of-work.port';

@Injectable()
export class PrismaCancelOrderUnitOfWork implements CancelOrderUnitOfWork {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  run<T>(operation: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation);
  }
}
