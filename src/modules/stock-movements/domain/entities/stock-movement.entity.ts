import { StockMovementType } from '@prisma/client';

export interface StockMovementState {
  id: string;
  movementType: StockMovementType;
  productId?: string | null;
  variantId: string;
  sku?: string | null;
  warehouseId: string;
  quantity: number;
  quantityDelta?: number;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  referenceType: string;
  referenceId: string;
  orderId?: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  reason: string | null;
  source?: string;
  rawMetadata?: unknown;
  createdByUserId: string | null;
  createdAt: Date;
}

export class StockMovementEntity {
  constructor(private readonly state: StockMovementState) {}

  static fromState(state: StockMovementState): StockMovementEntity {
    return new StockMovementEntity(state);
  }

  toResponse() {
    return {
      id: this.state.id,
      movementType: this.state.movementType,
      productId: this.state.productId ?? null,
      variantId: this.state.variantId,
      sku: this.state.sku ?? null,
      warehouseId: this.state.warehouseId,
      quantity: this.state.quantity,
      quantityDelta: this.state.quantityDelta ?? 0,
      quantityBefore: this.state.quantityBefore ?? null,
      quantityAfter: this.state.quantityAfter ?? null,
      referenceType: this.state.referenceType,
      referenceId: this.state.referenceId,
      orderId: this.state.orderId ?? null,
      reasonCode: this.state.reasonCode ?? null,
      reasonText: this.state.reasonText ?? null,
      reason: this.state.reason,
      source: this.state.source ?? 'system',
      rawMetadata: this.state.rawMetadata ?? null,
      createdByUserId: this.state.createdByUserId,
      createdAt: this.state.createdAt,
    };
  }
}
