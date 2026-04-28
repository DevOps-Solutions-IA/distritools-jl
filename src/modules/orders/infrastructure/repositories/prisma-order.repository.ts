import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  CreateOrderRecord,
  OrderRepository,
} from 'src/modules/orders/domain/repositories/order.repository';
import { OrderStatus } from '@prisma/client';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapOrder(record: {
    id: string;
    orderNumber: string;
    status: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingNotes: string | null;
    subtotal: { toFixed: (digits: number) => string };
    discountTotal: { toFixed: (digits: number) => string };
    taxTotal: { toFixed: (digits: number) => string };
    shippingTotal: { toFixed: (digits: number) => string };
    grandTotal: { toFixed: (digits: number) => string };
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: record.id,
      orderNumber: record.orderNumber,
      status: record.status as CreateOrderRecord['status'],
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      customerPhone: record.customerPhone,
      shippingAddress: record.shippingAddress,
      shippingCity: record.shippingCity,
      shippingNotes: record.shippingNotes,
      subtotal: record.subtotal.toFixed(2),
      discountTotal: record.discountTotal.toFixed(2),
      taxTotal: record.taxTotal.toFixed(2),
      shippingTotal: record.shippingTotal.toFixed(2),
      grandTotal: record.grandTotal.toFixed(2),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async create(tx: PrismaTransactionClient, data: CreateOrderRecord) {
    const created = await tx.order.create({
      data,
    });

    return this.mapOrder(created);
  }

  async findById(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? this.prisma;
    const record = await client.order.findUnique({
      where: { id },
    });

    return record ? this.mapOrder(record) : null;
  }

  async findByOrderNumber(orderNumber: string, tx?: PrismaTransactionClient) {
    const client = tx ?? this.prisma;
    const record = await client.order.findUnique({
      where: { orderNumber },
    });

    return record ? this.mapOrder(record) : null;
  }

  async updateStatus(
    tx: PrismaTransactionClient,
    id: string,
    status: OrderStatus,
  ) {
    const updated = await tx.order.update({
      where: { id },
      data: { status },
    });

    return this.mapOrder(updated);
  }
}
