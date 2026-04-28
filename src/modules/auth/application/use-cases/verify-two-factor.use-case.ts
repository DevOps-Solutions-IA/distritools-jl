import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepository,
} from 'src/modules/auth/domain/repositories/auth-session.repository';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from 'src/modules/auth/domain/repositories/auth-user.repository';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from 'src/modules/auth/application/ports/token-service.port';
import {
  TWO_FACTOR_PORT,
  TwoFactorPort,
} from 'src/modules/auth/application/ports/two-factor.port';
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';
import { hash } from 'bcrypt';

export interface VerifyTwoFactorInput {
  challengeToken: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class VerifyTwoFactorUseCase {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    @Inject(TWO_FACTOR_PORT)
    private readonly twoFactorPort: TwoFactorPort,
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: VerifyTwoFactorInput) {
    const challengeClaims = await this.tokenService.verifyTwoFactorChallenge(
      input.challengeToken,
    );
    const record = await this.authUserRepository.findById(challengeClaims.sub);

    if (!record) {
      throw new UnauthorizedException('Admin user not found');
    }

    const user = AdminUserEntity.fromState(record);
    user.ensureActive();
    user.ensureTwoFactorConfigured();

    if (!(await this.twoFactorPort.verify(user.twoFactorSecret!, input.code))) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const sessionId = uuidv7();
    const tokenPair = await this.tokenService.issueTokenPair(
      user.toJwtClaims(sessionId),
    );

    await this.authSessionRepository.create({
      id: sessionId,
      userId: user.id,
      tokenFamily: tokenPair.tokenFamily,
      currentJti: tokenPair.refreshTokenId,
      refreshTokenHash: await hash(tokenPair.refreshToken, 12),
      expiresAt: tokenPair.refreshExpiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    await this.authUserRepository.touchLastLogin(user.id);
    await this.auditRepository.write({
      actorUserId: user.id,
      action: 'auth.2fa_verified',
      entityType: 'user',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleName,
        permissions: user.permissions,
      },
    };
  }
}
