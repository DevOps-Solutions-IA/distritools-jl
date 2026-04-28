import { Prisma } from '@prisma/client';

export interface BrandState {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: Prisma.JsonValue | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BrandEntity {
  private constructor(private readonly state: BrandState) {}

  static fromState(state: BrandState) {
    return new BrandEntity(state);
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
    };
  }
}
