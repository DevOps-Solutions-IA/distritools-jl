import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v7 as uuidv7 } from 'uuid';
import { parseTokenTtlMilliseconds } from 'src/common/security/auth-security-config';
import {
  AccessTokenClaims,
  TokenPair,
  TokenServicePort,
  TwoFactorChallengeClaims,
} from 'src/modules/auth/application/ports/token-service.port';

@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async issueTwoFactorChallenge(
    claims: Omit<TwoFactorChallengeClaims, 'jti'>,
  ): Promise<{ token: string; challengeId: string; expiresAt: Date }> {
    const challengeId = uuidv7();
    const ttlMilliseconds = parseTokenTtlMilliseconds('JWT_2FA_CHALLENGE_TTL');
    const expiresAt = new Date(Date.now() + ttlMilliseconds);
    const token = await this.jwtService.signAsync({ ...claims, jti: challengeId }, {
      secret: this.getRequiredEnv('JWT_2FA_CHALLENGE_SECRET'),
      expiresIn: ttlMilliseconds / 1000,
      audience: 'admin-2fa',
      issuer: 'distritoolsjl',
    });
    return { token, challengeId, expiresAt };
  }

  async verifyTwoFactorChallenge(
    token: string,
  ): Promise<TwoFactorChallengeClaims> {
    try {
      const claims = await this.jwtService.verifyAsync<TwoFactorChallengeClaims>(token, {
        secret: this.getRequiredEnv('JWT_2FA_CHALLENGE_SECRET'),
        audience: 'admin-2fa',
        issuer: 'distritoolsjl',
      });
      if (!claims.sub || !claims.email || !claims.jti) {
        throw new Error('Invalid 2FA challenge claims');
      }
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid 2FA challenge token');
    }
  }

  async issueTokenPair(claims: AccessTokenClaims): Promise<TokenPair> {
    const refreshTokenId = uuidv7();
    const tokenFamily = uuidv7();
    const accessTtlSeconds = parseTokenTtlMilliseconds('JWT_ACCESS_TTL') / 1000;
    const refreshTtlMilliseconds = parseTokenTtlMilliseconds('JWT_REFRESH_TTL');
    const refreshExpiresAt = new Date(Date.now() + refreshTtlMilliseconds);

    const accessToken = await this.jwtService.signAsync(claims, {
      secret: this.getRequiredEnv('JWT_ACCESS_SECRET'),
      expiresIn: accessTtlSeconds,
      issuer: 'distritoolsjl',
      audience: 'admin-api',
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        ...claims,
        jti: refreshTokenId,
        family: tokenFamily,
      },
      {
        secret: this.getRequiredEnv('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtlMilliseconds / 1000,
        issuer: 'distritoolsjl',
        audience: 'admin-refresh',
      },
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
      tokenFamily,
      refreshExpiresAt,
    };
  }

  async verifyRefreshToken(
    token: string,
  ): Promise<AccessTokenClaims & { jti: string; family: string }> {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: this.getRequiredEnv('JWT_REFRESH_SECRET'),
        issuer: 'distritoolsjl',
        audience: 'admin-refresh',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }
}
