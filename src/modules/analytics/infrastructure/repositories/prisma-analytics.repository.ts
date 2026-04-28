import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AnalyticsRepository,
  SalesSummary,
  TopProductRecord,
} from 'src/modules/analytics/domain/repositories/analytics.repository';
import { Decimal } from '@prisma/client/runtime/library';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSalesSummary(windowFrom?: Date, windowTo?: Date): Promise<SalesSummary> {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(windowFrom || windowTo
          ? {
              createdAt: {
                ...(windowFrom ? { gte: windowFrom } : {}),
                ...(windowTo ? { lte: windowTo } : {}),
              },
            }
          : {}),
      },
    });

    const grossRevenue = orders.reduce(
      (sum, order) => sum.add(order.subtotal),
      new Decimal(0),
    );
    const discountTotal = orders.reduce(
      (sum, order) => sum.add(order.discountTotal),
      new Decimal(0),
    );
    const netRevenue = orders.reduce(
      (sum, order) => sum.add(order.grandTotal),
      new Decimal(0),
    );

    return {
      orderCount: orders.length,
      grossRevenue: grossRevenue.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      netRevenue: netRevenue.toFixed(2),
    };
  }

  async getTopProducts(
    limit: number,
    windowFrom?: Date,
    windowTo?: Date,
  ): Promise<TopProductRecord[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: windowFrom || windowTo
          ? {
              createdAt: {
                ...(windowFrom ? { gte: windowFrom } : {}),
                ...(windowTo ? { lte: windowTo } : {}),
              },
            }
          : undefined,
      },
      include: {
        variant: true,
      },
    });

    const grouped = new Map<string, TopProductRecord>();
    for (const item of items) {
      const current = grouped.get(item.variantId) ?? {
        variantId: item.variantId,
        variantName: item.variantNameSnapshot,
        quantitySold: 0,
        revenue: '0.00',
      };

      current.quantitySold += item.quantity;
      current.revenue = new Decimal(current.revenue)
        .add(item.lineGrandTotal)
        .toFixed(2);
      grouped.set(item.variantId, current);
    }

    return Array.from(grouped.values())
      .sort(
        (left, right) =>
          right.quantitySold - left.quantitySold ||
          Number(right.revenue) - Number(left.revenue),
      )
      .slice(0, limit);
  }

  async getOrderStatusCounts() {
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return Object.fromEntries(grouped.map((entry) => [entry.status, entry._count.status]));
  }

  async getPaymentStatusCounts() {
    const grouped = await this.prisma.payment.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return Object.fromEntries(grouped.map((entry) => [entry.status, entry._count.status]));
  }

  async getInventoryStatus() {
    const inventoryItems = await this.prisma.inventoryItem.findMany();
    const lowStock = inventoryItems.filter(
      (item) => item.onHandQty - item.reservedQty <= 2,
    ).length;

    return {
      lowStock,
      totalTracked: inventoryItems.length,
    };
  }

  async refreshSnapshot(
    reportKey: string,
    payload: unknown,
    windowFrom?: Date,
    windowTo?: Date,
  ) {
    const existing = await this.prisma.analyticsSnapshot.findFirst({
      where: {
        reportKey,
        windowFrom: windowFrom ?? null,
        windowTo: windowTo ?? null,
      },
    });

    if (existing) {
      await this.prisma.analyticsSnapshot.update({
        where: { id: existing.id },
        data: {
          payload: payload as never,
          refreshedAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.analyticsSnapshot.create({
      data: {
        id: uuidv7(),
        reportKey,
        windowFrom: windowFrom ?? null,
        windowTo: windowTo ?? null,
        payload: payload as never,
        refreshedAt: new Date(),
      },
    });
  }

  async getSnapshot(reportKey: string, windowFrom?: Date, windowTo?: Date) {
    const snapshot = await this.prisma.analyticsSnapshot.findFirst({
      where: {
        reportKey,
        windowFrom: windowFrom ?? null,
        windowTo: windowTo ?? null,
      },
    });

    return snapshot?.payload ?? null;
  }
}
