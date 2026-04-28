import { AuthenticatedUser } from 'src/modules/auth/interfaces/authenticated-user.interface';

export interface AuthUserRepository {
  findByEmail(email: string): Promise<AuthenticatedUser | null>;
  findById(id: string): Promise<AuthenticatedUser | null>;
  touchLastLogin(userId: string): Promise<void>;
}

export const AUTH_USER_REPOSITORY = Symbol('AUTH_USER_REPOSITORY');
