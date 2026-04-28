import { BadRequestException, ConflictException } from '@nestjs/common';

export interface InventoryItemState {
  id: string;
  variantId: string;
  warehouseId: string;
  onHandQty: number;
  reservedQty: number;
  createdAt: Date;
  updatedAt: Date;
}

export class InventoryItemEntity {
  constructor(private readonly state: InventoryItemState) {}

  static fromState(state: InventoryItemState): InventoryItemEntity {
    return new InventoryItemEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get variantId(): string {
    return this.state.variantId;
  }

  get warehouseId(): string {
    return this.state.warehouseId;
  }

  get onHandQty(): number {
    return this.state.onHandQty;
  }

  get reservedQty(): number {
    return this.state.reservedQty;
  }

  get availableQty(): number {
    return this.state.onHandQty - this.state.reservedQty;
  }

  ensureCanReserve(quantity: number): void {
    this.ensurePositiveQuantity(quantity);

    if (this.availableQty < quantity) {
      throw new ConflictException('Insufficient available stock');
    }
  }

  ensureCanRelease(quantity: number): void {
    this.ensurePositiveQuantity(quantity);

    if (this.reservedQty < quantity) {
      throw new ConflictException('Reserved stock is insufficient');
    }
  }

  ensureCanCommit(quantity: number): void {
    this.ensurePositiveQuantity(quantity);

    if (this.reservedQty < quantity) {
      throw new ConflictException('Reserved stock is insufficient for commit');
    }

    if (this.onHandQty < quantity) {
      throw new ConflictException('On-hand stock is insufficient for commit');
    }
  }

  ensureAdjustmentResult(delta: number): void {
    const nextOnHand = this.onHandQty + delta;

    if (nextOnHand < 0) {
      throw new ConflictException('On-hand stock cannot become negative');
    }

    if (this.reservedQty > nextOnHand) {
      throw new ConflictException(
        'Reserved stock cannot exceed on-hand stock after adjustment',
      );
    }
  }

  toResponse() {
    return {
      id: this.id,
      variantId: this.variantId,
      warehouseId: this.warehouseId,
      onHandQty: this.onHandQty,
      reservedQty: this.reservedQty,
      availableQty: this.availableQty,
    };
  }

  private ensurePositiveQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
  }
}
