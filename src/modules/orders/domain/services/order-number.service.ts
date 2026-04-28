import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderNumberService {
  generate(): string {
    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const randomPart = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');

    return `DTJL-${datePart}-${randomPart}`;
  }
}
