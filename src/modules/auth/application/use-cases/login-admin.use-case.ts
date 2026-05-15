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
    user.ensureTwoFactorConfigured();

    const challengeToken = await this.tokenService.issueTwoFactorChallenge({
      sub: user.id,
      email: user.email,
    });

    await this.auditRepository.write({
      actorUserId: user.id,
      action: 'auth.login_challenged',
      entityType: 'user',
      entityId: user.id,
    });

    return {
      challengeToken,
    };
  }
}
