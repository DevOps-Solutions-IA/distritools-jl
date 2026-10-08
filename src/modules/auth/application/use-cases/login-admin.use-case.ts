import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from 'src/modules/auth/domain/repositories/auth-user.repository';
import { AuthPolicyService } from 'src/modules/auth/domain/services/auth-policy.service';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from 'src/modules/auth/application/ports/token-service.port';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  TWO_FACTOR_CHALLENGE_REPOSITORY,
  TwoFactorChallengeRepository,
} from 'src/modules/auth/domain/repositories/two-factor-challenge.repository';

export interface LoginAdminInput {
  email: string;
  password: string;
}

export interface LoginAdminResult {
  challengeToken: string;
}

@Injectable()
export class LoginAdminUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AuthPolicyService)
    private readonly authPolicyService: AuthPolicyService,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(TWO_FACTOR_CHALLENGE_REPOSITORY)
    private readonly twoFactorChallengeRepository: TwoFactorChallengeRepository,
  ) {}

  async execute(input: LoginAdminInput): Promise<LoginAdminResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const record = await this.authUserRepository.findByEmail(normalizedEmail);

    if (!record) {
      await this.authPolicyService.dummyVerify();
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = AdminUserEntity.fromState(record);
    await this.authPolicyService.verifyPassword(user, input.password);
    try {
      user.ensureTwoFactorConfigured();
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    const challenge = await this.tokenService.issueTwoFactorChallenge({
      sub: user.id,
      email: user.email,
    });
    await this.twoFactorChallengeRepository.create({
      id: challenge.challengeId,
      userId: user.id,
      expiresAt: challenge.expiresAt,
    });

    await this.auditRepository.write({
      actorUserId: user.id,
      action: 'auth.login_challenged',
      entityType: 'user',
      entityId: user.id,
    });

    return {
      challengeToken: challenge.token,
    };
  }
}
