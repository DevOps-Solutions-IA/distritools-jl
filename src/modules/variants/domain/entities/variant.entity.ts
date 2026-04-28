export interface VariantState {
  id: string;
  productId: string | null;
  sku: string;
  name: string;
  price: string;
  taxRate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    brand: { id: string; name: string; slug: string } | null;
    category: { id: string; name: string; slug: string } | null;
  } | null;
}

export class VariantEntity {
  private constructor(private readonly state: VariantState) {}

  static fromState(state: VariantState) {
    return new VariantEntity(state);
  }

  get id() {
    return this.state.id;
  }

  get sku() {
    return this.state.sku;
  }

  get isActive() {
    return this.state.isActive;
  }

  toAdminResponse() {
    return {
      ...this.state,
      createdAt: this.state.createdAt.toISOString(),
      updatedAt: this.state.updatedAt.toISOString(),
    };
  }

  toPublicResponse() {
    return {
      id: this.state.id,
      productId: this.state.productId,
      sku: this.state.sku,
      name: this.state.name,
      price: this.state.price,
      taxRate: this.state.taxRate,
      product: this.state.product,
    };
  }
}
