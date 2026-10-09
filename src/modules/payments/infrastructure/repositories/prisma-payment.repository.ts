import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreatePaymentRecord,
  PaymentRepository,
  UpdatePaymentRecord,
} from 'src/modules/payments/domain/repositories/payment.repository';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapPayment(record: {
    id: string;
    orderId: string;
    gateway: string;
    gatewayReference: string;
    transactionId: string | null;
    amount: { toFixed: (digits: number) => string };
    currency: string;
    status: string;
    rawPayload: unknown;
    confirmedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: record.id,
      orderId: record.orderId,
      gateway: record.gateway,
      gatewayReference: record.gatewayReference,
      transactionId: record.transactionId,
      amount: record.amount.toFixed(2),
      currency: record.currency,
      status: record.status as CreatePaymentRecord['status'],
      rawPayload: record.rawPayload,
      confirmedAt: record.confirmedAt,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async create(tx: PrismaTransactionClient, data: CreatePaymentRecord) {
    const created = await tx.payment.create({
      data,
    });

    return this.mapPayment(created);
  }

  async lockForUpdate(tx: PrismaTransactionClient, id: string): Promise<void> {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE
    `);
  }

  async findById(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? this.prisma;
    const record = await client.payment.findUnique({
      where: { id },
    });

    return record ? this.mapPayment(record) : null;
  }

  async findByGatewayReference(
    gateway: string,
    gatewayReference: string,
    tx?: PrismaTransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const record = await client.payment.findUnique({
      where: {
        gateway_gatewayReference: {
          gateway,
          gatewayReference,
        },
      },
    });

    return record ? this.mapPayment(record) : null;
  }

  async findPendingByOrder(orderId: string, tx?: PrismaTransactionClient) {
    const client = tx ?? this.prisma;
    const record = await client.payment.findFirst({
      where: { orderId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    return record ? this.mapPayment(record) : null;
  }

  async update(tx: PrismaTransactionClient, data: UpdatePaymentRecord) {
    const updated = await tx.payment.update({
      where: { id: data.id },
      data: {
        status: data.status,
        transactionId: data.transactionId,
        rawPayload: data.rawPayload as unknown as Prisma.InputJsonValue,
        confirmedAt: data.confirmedAt,
        expiresAt: data.expiresAt,
      },
    });

    return this.mapPayment(updated);
  }
}
