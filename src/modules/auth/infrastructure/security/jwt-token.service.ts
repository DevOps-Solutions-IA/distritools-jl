import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v7 as uuidv7 } from 'uuid';
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
    claims: TwoFactorChallengeClaims,
  ): Promise<string> {
    return this.jwtService.signAsync(claims, {
      secret: this.getRequiredEnv('JWT_2FA_CHALLENGE_SECRET'),
      expiresIn: this.parseDurationToSeconds(
        process.env.JWT_2FA_CHALLENGE_TTL ?? '10m',
      ),
      audience: 'admin-2fa',
      issuer: 'distritoolsjl',
    });
  }

  async verifyTwoFactorChallenge(
    token: string,
  ): Promise<TwoFactorChallengeClaims> {
    try {
      return await this.jwtService.verifyAsync<TwoFactorChallengeClaims>(token, {
        secret: this.getRequiredEnv('JWT_2FA_CHALLENGE_SECRET'),
        audience: 'admin-2fa',
        issuer: 'distritoolsjl',
      });
    } catch {
      throw new UnauthorizedException('Invalid 2FA challenge token');
    }
  }

  async issueTokenPair(claims: AccessTokenClaims): Promise<TokenPair> {
    const refreshTokenId = uuidv7();
    const tokenFamily = uuidv7();
    const refreshExpiresAt = this.computeExpiryDate(
      process.env.JWT_REFRESH_TTL ?? '7d',
    );

    const accessToken = await this.jwtService.signAsync(claims, {
      secret: this.getRequiredEnv('JWT_ACCESS_SECRET'),
      expiresIn: this.parseDurationToSeconds(
        process.env.JWT_ACCESS_TTL ?? '15m',
      ),
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
        expiresIn: this.parseDurationToSeconds(
          process.env.JWT_REFRESH_TTL ?? '7d',
        ),
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

  private computeExpiryDate(duration: string): Date {
    return new Date(Date.now() + this.parseDurationToMilliseconds(duration));
  }

  private parseDurationToMilliseconds(duration: string): number {
    const match = duration.match(/^(\d+)([mhd])$/);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multiplier =
      unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

    return value * multiplier;
  }

  private parseDurationToSeconds(duration: string): number {
    return Math.floor(this.parseDurationToMilliseconds(duration) / 1000);
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }
}
