export interface CategoryState {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CategoryEntity {
  private constructor(private readonly state: CategoryState) {}

  static fromState(state: CategoryState) {
    return new CategoryEntity(state);
  }

  get id() {
    return this.state.id;
  }

  get parentId() {
    return this.state.parentId;
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
      parentId: this.state.parentId,
      name: this.state.name,
      slug: this.state.slug,
      description: this.state.description,
      sortOrder: this.state.sortOrder,
    };
  }
}
