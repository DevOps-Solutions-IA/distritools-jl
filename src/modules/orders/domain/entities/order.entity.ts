import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

export interface OrderState {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingNotes: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  createdAt: Date;
  updatedAt: Date;
}

export class OrderEntity {
  constructor(private readonly state: OrderState) {}

  static fromState(state: OrderState): OrderEntity {
    return new OrderEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get orderNumber(): string {
    return this.state.orderNumber;
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  ensureCanCancel(): void {
    if (this.state.status !== OrderStatus.pending_payment) {
      throw new ConflictException(
        `Order cannot be cancelled from status ${this.state.status}`,
      );
    }
  }

  ensureTotalsConsistency(): void {
    const subtotal = Number(this.state.subtotal);
    const discountTotal = Number(this.state.discountTotal);
    const taxTotal = Number(this.state.taxTotal);
    const shippingTotal = Number(this.state.shippingTotal);
    const grandTotal = Number(this.state.grandTotal);
    const calculated = subtotal - discountTotal + taxTotal + shippingTotal;

    if (Math.abs(calculated - grandTotal) > 0.0001) {
      throw new BadRequestException('Order totals are inconsistent');
    }
  }

  toPublicResponse() {
    return {
      id: this.state.id,
      orderNumber: this.state.orderNumber,
      status: this.state.status,
      customerName: this.state.customerName,
      grandTotal: this.state.grandTotal,
      createdAt: this.state.createdAt,
    };
  }

  toAdminResponse(orderItems: unknown[]) {
    return {
      id: this.state.id,
      orderNumber: this.state.orderNumber,
      status: this.state.status,
      customer: {
        name: this.state.customerName,
        email: this.state.customerEmail,
        phone: this.state.customerPhone,
      },
      shipping: {
        address: this.state.shippingAddress,
        city: this.state.shippingCity,
        notes: this.state.shippingNotes,
      },
      totals: {
        subtotal: this.state.subtotal,
        discountTotal: this.state.discountTotal,
        taxTotal: this.state.taxTotal,
        shippingTotal: this.state.shippingTotal,
        grandTotal: this.state.grandTotal,
      },
      items: orderItems,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    };
  }
}
