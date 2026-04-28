import { Injectable } from '@nestjs/common';
import { verify } from 'otplib';
import { TwoFactorPort } from 'src/modules/auth/application/ports/two-factor.port';

@Injectable()
export class TwoFactorService implements TwoFactorPort {
  async verify(secret: string, code: string): Promise<boolean> {
    const result = await verify({ secret, token: code });
    return result.valid;
  }
}
