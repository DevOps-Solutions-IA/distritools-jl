export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
}

export interface TwoFactorChallengeClaims {
  sub: string;
  email: string;
  jti: string;
}

export interface IssuedTwoFactorChallenge {
  token: string;
  challengeId: string;
  expiresAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  tokenFamily: string;
  refreshExpiresAt: Date;
}

export interface TokenServicePort {
  issueTwoFactorChallenge(claims: Omit<TwoFactorChallengeClaims, 'jti'>): Promise<IssuedTwoFactorChallenge>;
  verifyTwoFactorChallenge(token: string): Promise<TwoFactorChallengeClaims>;
  issueTokenPair(claims: AccessTokenClaims): Promise<TokenPair>;
  verifyRefreshToken(token: string): Promise<AccessTokenClaims & { jti: string; family: string }>;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
