export interface TwoFactorChallengeRepository {
  create(input: { id: string; userId: string; expiresAt: Date }): Promise<void>;
  consume(id: string, userId: string, now?: Date): Promise<boolean>;
}

export const TWO_FACTOR_CHALLENGE_REPOSITORY = Symbol('TWO_FACTOR_CHALLENGE_REPOSITORY');
