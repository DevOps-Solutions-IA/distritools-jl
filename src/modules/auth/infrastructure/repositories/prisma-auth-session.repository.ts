import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AuthSessionRepository,
  CreateAuthSessionInput,
} from 'src/modules/auth/domain/repositories/auth-session.repository';

@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateAuthSessionInput): Promise<void> {
    await this.prisma.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        tokenFamily: input.tokenFamily,
        currentJti: input.currentJti,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.authSession.findUnique({
      where: { id },
    });
  }

  async rotate(
    sessionId: string,
    expectedCurrentJti: string,
    nextTokenHash: string,
    nextJti: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        currentJti: expectedCurrentJti,
        revokedAt: null,
        compromisedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: nextTokenHash,
        currentJti: nextJti,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeFamily(tokenFamily: string): Promise<void> {
    const timestamp = new Date();

    await this.prisma.authSession.updateMany({
      where: { tokenFamily, revokedAt: null },
      data: {
        revokedAt: timestamp,
        compromisedAt: timestamp,
      },
    });
  }
}
