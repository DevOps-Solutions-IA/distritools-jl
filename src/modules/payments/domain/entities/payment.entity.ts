import { ConflictException } from '@nestjs/common';

export type PaymentStatusValue =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'refunded';

export interface PaymentState {
  id: string;
  orderId: string;
  gateway: string;
  gatewayReference: string;
  transactionId: string | null;
  amount: string;
  currency: string;
  status: PaymentStatusValue;
  rawPayload: unknown;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentEntity {
  constructor(private readonly state: PaymentState) {}

  static fromState(state: PaymentState): PaymentEntity {
    return new PaymentEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get orderId(): string {
    return this.state.orderId;
  }

  get gateway(): string {
    return this.state.gateway;
  }

  get gatewayReference(): string {
    return this.state.gatewayReference;
  }

  get status(): PaymentStatusValue {
    return this.state.status;
  }

  get transactionId(): string | null {
    return this.state.transactionId;
  }

  ensurePending(): void {
    if (this.state.status !== 'pending') {
      throw new ConflictException(
        `Payment must be pending, current status is ${this.state.status}`,
      );
    }
  }

  ensureFinalizable(): void {
    if (this.state.status !== 'pending') {
      throw new ConflictException(
        `Payment webhook cannot transition status ${this.state.status}`,
      );
    }
  }

  toResponse() {
    return {
      id: this.state.id,
      orderId: this.state.orderId,
      gateway: this.state.gateway,
      gatewayReference: this.state.gatewayReference,
      transactionId: this.state.transactionId,
      amount: this.state.amount,
      currency: this.state.currency,
      status: this.state.status,
      confirmedAt: this.state.confirmedAt,
      expiresAt: this.state.expiresAt,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    };
  }
}
