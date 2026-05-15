import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from 'src/modules/auth/domain/repositories/auth-user.repository';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepository,
} from 'src/modules/auth/domain/repositories/auth-session.repository';
import { AdminUserEntity } from 'src/modules/auth/domain/entities/admin-user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error('Missing required environment variable: JWT_ACCESS_SECRET');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: 'distritoolsjl',
      audience: 'admin-api',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    const record = await this.authUserRepository.findById(payload.sub);

    if (!record) {
      this.logger.warn(`JWT validation failed: user ${payload.sub} not found`);
      throw new UnauthorizedException();
    }

    const user = AdminUserEntity.fromState(record);

    try {
      user.ensureActive();
    } catch {
      this.logger.warn(`JWT validation failed: user ${payload.sub} is inactive`);
      throw new UnauthorizedException();
    }

    const session = await this.authSessionRepository.findById(payload.sessionId);

    if (!session) {
      this.logger.warn(`JWT validation failed: session ${payload.sessionId} not found`);
      throw new UnauthorizedException();
    }

    if (session.revokedAt || session.compromisedAt) {
      this.logger.warn(`JWT validation failed: session ${payload.sessionId} has been revoked or compromised`);
      throw new UnauthorizedException();
    }

    if (session.expiresAt && new Date() > session.expiresAt) {
      this.logger.warn(`JWT validation failed: session ${payload.sessionId} has expired`);
      throw new UnauthorizedException();
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.roleSlug,
      permissions: user.permissions,
      sessionId: payload.sessionId,
    };
  }
}
