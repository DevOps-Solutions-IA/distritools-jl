import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { isProductionOrStaging } from 'src/common/security/env-check';
import { assertAuthSecurityConfig } from 'src/common/security/auth-security-config';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  AUDIT_REPOSITORY,
} from 'src/modules/auth/domain/repositories/audit.repository';
import {
  AUTH_SESSION_REPOSITORY,
} from 'src/modules/auth/domain/repositories/auth-session.repository';
import {
  AUTH_USER_REPOSITORY,
} from 'src/modules/auth/domain/repositories/auth-user.repository';
import { TWO_FACTOR_CHALLENGE_REPOSITORY } from 'src/modules/auth/domain/repositories/two-factor-challenge.repository';
import { AuthPolicyService } from 'src/modules/auth/domain/services/auth-policy.service';
import { LoginAdminUseCase } from 'src/modules/auth/application/use-cases/login-admin.use-case';
import { LogoutUseCase } from 'src/modules/auth/application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from 'src/modules/auth/application/use-cases/refresh-token.use-case';
import { VerifyTwoFactorUseCase } from 'src/modules/auth/application/use-cases/verify-two-factor.use-case';
import { TOKEN_SERVICE } from 'src/modules/auth/application/ports/token-service.port';
import { TWO_FACTOR_PORT } from 'src/modules/auth/application/ports/two-factor.port';
import { AuthController } from 'src/modules/auth/infrastructure/http/controllers/auth.controller';
import { AdminSessionController } from 'src/modules/auth/infrastructure/http/controllers/admin-session.controller';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';
import { PrismaAuthSessionRepository } from 'src/modules/auth/infrastructure/repositories/prisma-auth-session.repository';
import { PrismaTwoFactorChallengeRepository } from 'src/modules/auth/infrastructure/repositories/prisma-two-factor-challenge.repository';
import { PrismaAuthUserRepository } from 'src/modules/auth/infrastructure/repositories/prisma-auth-user.repository';
import { JwtTokenService } from 'src/modules/auth/infrastructure/security/jwt-token.service';
import { JwtStrategy } from 'src/modules/auth/infrastructure/security/jwt.strategy';
import { TwoFactorService } from 'src/modules/auth/infrastructure/security/two-factor.service';
import { TwoFactorEncryptionService } from 'src/common/security/two-factor-encryption.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        assertAuthSecurityConfig();
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret || secret === 'change-me-access') {
          if (isProductionOrStaging()) {
            throw new Error(
              'FATAL: JWT_ACCESS_SECRET is missing or using placeholder value in production/staging. Set a strong secret.',
            );
          }
          console.warn('WARNING: JWT_ACCESS_SECRET is not set or using placeholder. Using dev-only fallback.');
          return { secret: 'dev-fallback-jwt-secret-do-not-use-in-production' };
        }

        return { secret };
      },
    }),
  ],
  controllers: [AuthController, AdminSessionController],
  providers: [
    TwoFactorEncryptionService,
    AuthPolicyService,
    LoginAdminUseCase,
    VerifyTwoFactorUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    PrismaAuthUserRepository,
    PrismaAuthSessionRepository,
    PrismaTwoFactorChallengeRepository,
    PrismaAuditRepository,
    JwtTokenService,
    TwoFactorService,
    JwtStrategy,
    {
      provide: AUTH_USER_REPOSITORY,
      useExisting: PrismaAuthUserRepository,
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      useExisting: PrismaAuthSessionRepository,
    },
    {
      provide: TWO_FACTOR_CHALLENGE_REPOSITORY,
      useExisting: PrismaTwoFactorChallengeRepository,
    },
    {
      provide: AUDIT_REPOSITORY,
      useExisting: PrismaAuditRepository,
    },
    {
      provide: TOKEN_SERVICE,
      useExisting: JwtTokenService,
    },
    {
      provide: TWO_FACTOR_PORT,
      useExisting: TwoFactorService,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [AUDIT_REPOSITORY, JwtModule],
})
export class AuthModule {}
