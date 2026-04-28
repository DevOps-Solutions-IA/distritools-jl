import { ContentType } from '@prisma/client';

export interface ContentBlockState {
  id: string;
  title: string;
  slug: string | null;
  type: ContentType;
  placementKey: string;
  body: unknown;
  isPublished: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ContentBlockEntity {
  constructor(private readonly state: ContentBlockState) {}

  static fromState(state: ContentBlockState): ContentBlockEntity {
    return new ContentBlockEntity(state);
  }

  isVisibleAt(at: Date): boolean {
    if (!this.state.isPublished) {
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
