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

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain) {
      return '***';
    }

    return `${name.slice(0, 2)}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.length <= 4 ? '****' : `${phone.slice(0, 3)}***${phone.slice(-2)}`;
  }

  toAdminResponse(orderItems: unknown[], options: { sensitive: boolean; financial: boolean }) {
    return {
      id: this.state.id,
      orderNumber: this.state.orderNumber,
      status: this.state.status,
      customer: {
        name: options.sensitive ? this.state.customerName : this.maskName(this.state.customerName),
        email: this.maskEmail(this.state.customerEmail),
        phone: this.maskPhone(this.state.customerPhone),
      },
      shipping: {
        address: options.sensitive ? this.state.shippingAddress : 'Dirección protegida',
        city: this.state.shippingCity,
        notes: options.sensitive ? this.state.shippingNotes : '[PROTECTED]',
      },
      totals: {
        subtotal: options.financial ? this.state.subtotal : 'NO_PERMISSION',
        discountTotal: options.financial ? this.state.discountTotal : 'NO_PERMISSION',
        taxTotal: options.financial ? this.state.taxTotal : 'NO_PERMISSION',
        shippingTotal: options.financial ? this.state.shippingTotal : 'NO_PERMISSION',
        grandTotal: options.financial ? this.state.grandTotal : 'NO_PERMISSION',
      },
      items: options.financial
        ? orderItems
        : (orderItems as Array<Record<string, unknown>>).map((item) => ({
            ...item,
            unitPrice: 'NO_PERMISSION',
            lineSubtotal: 'NO_PERMISSION',
            lineTaxTotal: 'NO_PERMISSION',
            lineGrandTotal: 'NO_PERMISSION',
            lineDiscountTotal: 'NO_PERMISSION',
          })),
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    };
  }

  private maskName(name: string) {
    return name.trim().split(/\s+/).filter(Boolean).map((part) => `${part[0]}***`).join(' ') || '[PROTECTED]';
  }
}
