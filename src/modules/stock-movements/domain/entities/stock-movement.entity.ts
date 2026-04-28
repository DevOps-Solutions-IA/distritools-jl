import { StockMovementType } from '@prisma/client';

export interface StockMovementState {
  id: string;
  movementType: StockMovementType;
  variantId: string;
  warehouseId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  reason: string | null;
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
      variantId: this.state.variantId,
      warehouseId: this.state.warehouseId,
      quantity: this.state.quantity,
      referenceType: this.state.referenceType,
      referenceId: this.state.referenceId,
      reason: this.state.reason,
      createdByUserId: this.state.createdByUserId,
      createdAt: this.state.createdAt,
    };
  }
}
