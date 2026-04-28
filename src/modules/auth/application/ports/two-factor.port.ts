export interface TwoFactorPort {
  verify(secret: string, code: string): Promise<boolean>;
}

export const TWO_FACTOR_PORT = Symbol('TWO_FACTOR_PORT');
