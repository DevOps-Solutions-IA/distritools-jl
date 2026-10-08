export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenFamily: string;
  currentJti: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  compromisedAt: Date | null;
}

export interface CreateAuthSessionInput {
  id: string;
  userId: string;
  tokenFamily: string;
  currentJti: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<void>;
  findById(id: string): Promise<AuthSessionRecord | null>;
  rotate(
    sessionId: string,
    expectedCurrentJti: string,
    nextTokenHash: string,
    nextJti: string,
    expiresAt: Date,
  ): Promise<boolean>;
  revoke(sessionId: string): Promise<void>;
  revokeFamily(tokenFamily: string): Promise<void>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');
