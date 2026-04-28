import { UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from 'src/modules/auth/interfaces/authenticated-user.interface';

export class AdminUserEntity {
  constructor(private readonly state: AuthenticatedUser) {}

  static fromState(state: AuthenticatedUser): AdminUserEntity {
    return new AdminUserEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get email(): string {
    return this.state.email;
  }

  get fullName(): string {
    return this.state.fullName;
  }

  get roleSlug(): string {
    return this.state.role.slug;
  }

  get roleName(): string {
    return this.state.role.name;
  }

  get permissions(): string[] {
    return this.state.role.permissions;
  }

  get passwordHash(): string {
    return this.state.passwordHash;
  }

  get twoFactorSecret(): string | null {
    return this.state.twoFactorSecret;
  }

  ensureActive(): void {
    if (!this.state.isActive) {
      throw new UnauthorizedException('Admin account is inactive');
    }
  }

  ensureTwoFactorConfigured(): void {
    if (!this.state.twoFactorSecret) {
      throw new UnauthorizedException('Admin 2FA is not configured');
    }
  }

  toJwtClaims(sessionId: string) {
    return {
      sub: this.id,
      email: this.email,
      role: this.roleSlug,
      permissions: this.permissions,
      sessionId,
    };
  }
}
