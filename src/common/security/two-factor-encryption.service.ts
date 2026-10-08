import { Injectable, Logger } from '@nestjs/common';
import { isProductionOrStaging } from './env-check';
import { decryptTwoFactorSecret, encryptTwoFactorSecret } from './two-factor-crypto';

@Injectable()
export class TwoFactorEncryptionService {
  private readonly logger = new Logger(TwoFactorEncryptionService.name);

  constructor() {
    const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;

    if (!key || key.length < 32) {
      if (isProductionOrStaging()) {
        throw new Error('Invalid production 2FA encryption configuration.');
      }
      this.logger.error(
        'TWO_FACTOR_ENCRYPTION_KEY is missing or shorter than 32 characters. 2FA secrets will be stored in plain text.',
      );
    }
  }

  encrypt(secret: string): string {
    return encryptTwoFactorSecret(secret);
  }

  decrypt(stored: string | null): string | null {
    return decryptTwoFactorSecret(stored);
  }
}
