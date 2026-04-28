import { PromotionState } from 'src/modules/promotions/domain/entities/promotion.entity';

export interface CreatePromotionRecord {
  id: string;
  productId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  type: 'percentage' | 'fixed_amount';
  scope: 'line' | 'cart';
  stackingMode: 'exclusive' | 'stackable_same_scope' | 'stackable_cross_scope';
  priority: number;
  value: string;
  minSubtotal?: string | null;
  minQuantity?: number | null;
  targetType: 'all' | 'product' | 'variant' | 'category' | 'brand';
  targetIds?: unknown;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface UpdatePromotionRecord extends Partial<CreatePromotionRecord> {
  id: string;
}

export interface PromotionRepository {
  create(data: CreatePromotionRecord): Promise<PromotionState>;
  update(data: UpdatePromotionRecord): Promise<PromotionState>;
  findById(id: string): Promise<PromotionState | null>;
  findBySlug(slug: string): Promise<PromotionState | null>;
  list(): Promise<PromotionState[]>;
  listActive(at: Date): Promise<PromotionState[]>;
}

export const PROMOTION_REPOSITORY = Symbol('PROMOTION_REPOSITORY');
