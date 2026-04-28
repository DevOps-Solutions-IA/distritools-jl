import { ConflictException } from '@nestjs/common';

export interface RoleState {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleEntity {
  constructor(private readonly state: RoleState) {}

  static fromState(state: RoleState): RoleEntity {
    return new RoleEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get slug(): string {
    return this.state.slug;
  }

  ensureNotDuplicate(existing: RoleEntity | null): void {
    if (existing) {
      throw new ConflictException('Role slug already exists');
    }
  }
}
