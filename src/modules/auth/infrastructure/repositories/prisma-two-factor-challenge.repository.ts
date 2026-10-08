import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { TwoFactorChallengeRepository } from 'src/modules/auth/domain/repositories/two-factor-challenge.repository';

@Injectable()
export class PrismaTwoFactorChallengeRepository implements TwoFactorChallengeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: { id: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.prisma.authTwoFactorChallenge.create({ data: input });
  }

  async consume(id: string, userId: string, now = new Date()): Promise<boolean> {
    const result = await this.prisma.authTwoFactorChallenge.updateMany({
      where: { id, userId, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count === 1;
  }
}
