export interface ProductState {
  id: string;
  brandId: string | null;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  metadata: unknown | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string } | null;
}

export class ProductEntity {
  private constructor(private readonly state: ProductState) {}

  static fromState(state: ProductState) {
    return new ProductEntity(state);
  }

  get id() {
    return this.state.id;
  }

  get slug() {
    return this.state.slug;
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
      name: this.state.name,
      slug: this.state.slug,
      description: this.state.description,
      metadata: this.state.metadata,
      brand: this.state.brand,
      category: this.state.category,
    };
  }
}
