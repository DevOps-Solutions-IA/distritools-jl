import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';

@Injectable()
export class AuthPolicyService {
  async verifyPassword(
    user: AdminUserEntity,
    plaintextPassword: string,
  ): Promise<void> {
    user.ensureActive();

    const valid = await compare(plaintextPassword, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
