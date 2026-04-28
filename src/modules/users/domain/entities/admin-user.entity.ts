import { ConflictException, NotFoundException } from '@nestjs/common';

export interface AdminUserState {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleName: string;
  roleSlug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminUserEntity {
  constructor(private readonly state: AdminUserState) {}

  static fromState(state: AdminUserState): AdminUserEntity {
    return new AdminUserEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get fullName(): string {
    return this.state.fullName;
  }

  get email(): string {
    return this.state.email;
  }

  get phone(): string | null {
    return this.state.phone;
  }

  get roleId(): string {
    return this.state.roleId;
  }

  get roleName(): string {
    return this.state.roleName;
  }

  get roleSlug(): string {
    return this.state.roleSlug;
  }

  get isActive(): boolean {
    return this.state.isActive;
  }

  ensureExists(): void {
    if (!this.state.id) {
      throw new NotFoundException('Admin user not found');
    }
  }

  ensureActiveTransitionAllowed(nextState: boolean): void {
    if (!this.state.isActive && nextState === false) {
      throw new ConflictException('Admin user is already inactive');
    }
  }

  toResponse() {
    return {
      id: this.state.id,
      fullName: this.state.fullName,
      email: this.state.email,
      phone: this.state.phone,
      role: {
        id: this.state.roleId,
        name: this.state.roleName,
        slug: this.state.roleSlug,
      },
      isActive: this.state.isActive,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    };
  }
}
