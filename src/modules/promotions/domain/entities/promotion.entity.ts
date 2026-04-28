import {
  PromotionScope,
  PromotionStackingMode,
  PromotionTargetType,
  PromotionType,
} from '@prisma/client';

export interface PromotionState {
  id: string;
  productId: string | null;
  name: string;
  slug: string;
  description: string | null;
  type: PromotionType;
  scope: PromotionScope;
  stackingMode: PromotionStackingMode;
  priority: number;
  value: string;
  minSubtotal: string | null;
  minQuantity: number | null;
  targetType: PromotionTargetType;
  targetIds: unknown;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PromotionEntity {
  constructor(private readonly state: PromotionState) {}

  static fromState(state: PromotionState): PromotionEntity {
    return new PromotionEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get priority(): number {
    return this.state.priority;
  }

  get scope(): PromotionScope {
    return this.state.scope;
  }

  get stackingMode(): PromotionStackingMode {
    return this.state.stackingMode;
  }

  get type(): PromotionType {
    return this.state.type;
  }

  get targetType(): PromotionTargetType {
    return this.state.targetType;
  }

  get minQuantity(): number | null {
    return this.state.minQuantity;
  }

  get targetIds(): string[] {
    return Array.isArray(this.state.targetIds)
      ? this.state.targetIds.filter((value): value is string => typeof value === 'string')
      : [];
  }

  get value(): number {
    return Number(this.state.value);
  }

  get minSubtotal(): number | null {
    return this.state.minSubtotal === null ? null : Number(this.state.minSubtotal);
  }

  isCurrentlyActive(at: Date): boolean {
    if (!this.state.isActive) {
      return false;
    }

    if (this.state.startsAt && at < this.state.startsAt) {
      return false;
    }

    if (this.state.endsAt && at > this.state.endsAt) {
      return false;
    }

    return true;
  }

  toResponse() {
    return {
      ...this.state,
    };
  }
}
