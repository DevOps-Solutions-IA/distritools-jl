import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';

const DUMMY_HASH = '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

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

  async dummyVerify(): Promise<void> {
    await compare('dummy', DUMMY_HASH);
  }
}
