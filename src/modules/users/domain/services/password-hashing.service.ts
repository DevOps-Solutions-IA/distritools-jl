import { Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';

@Injectable()
export class PasswordHashingService {
  async hash(plainTextPassword: string): Promise<string> {
    return hash(plainTextPassword, 12);
  }
}
