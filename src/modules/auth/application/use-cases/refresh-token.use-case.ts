import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
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
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(refreshToken: string) {
    const claims = await this.tokenService.verifyRefreshToken(refreshToken);
    const session = await this.authSessionRepository.findById(claims.sessionId);

    if (!session || session.revokedAt || session.compromisedAt) {
      throw new UnauthorizedException('Refresh session is invalid');
    }

    const validHash = await compare(refreshToken, session.refreshTokenHash);

    if (!validHash || session.currentJti !== claims.jti) {
      await this.authSessionRepository.revokeFamily(session.tokenFamily);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const userRecord = await this.authUserRepository.findById(claims.sub);

    if (!userRecord) {
      throw new UnauthorizedException('Admin user not found');
    }

    const user = AdminUserEntity.fromState(userRecord);
    user.ensureActive();

    const nextPair = await this.tokenService.issueTokenPair(
      user.toJwtClaims(session.id),
    );

    const rotated = await this.authSessionRepository.rotate(
      session.id,
      claims.jti,
      await hash(nextPair.refreshToken, 12),
      nextPair.refreshTokenId,
      nextPair.refreshExpiresAt,
    );

    if (!rotated) {
      await this.authSessionRepository.revokeFamily(session.tokenFamily);
      await this.auditRepository.write({
        actorUserId: user.id,
        action: 'auth.refresh_reuse_detected',
        entityType: 'auth_session',
        entityId: session.id,
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    await this.auditRepository.write({
      actorUserId: user.id,
      action: 'auth.refresh_rotated',
      entityType: 'auth_session',
      entityId: session.id,
    });

    return {
      accessToken: nextPair.accessToken,
      refreshToken: nextPair.refreshToken,
    };
  }
}
