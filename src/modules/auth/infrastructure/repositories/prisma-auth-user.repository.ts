import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { TwoFactorEncryptionService } from 'src/common/security/two-factor-encryption.service';
import { AuthUserRepository } from 'src/modules/auth/domain/repositories/auth-user.repository';

@Injectable()
export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TwoFactorEncryptionService)
    private readonly twoFactorEncryption: TwoFactorEncryptionService,
  ) {}

  private mapUser(user: {
    id: string;
    email: string;
    fullName: string;
    passwordHash: string;
    isActive: boolean;
    twoFactorSecret: string | null;
    role: {
      id: string;
      slug: string;
      name: string;
      rolePermissions: { permission: { slug: string } }[];
    };
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      twoFactorSecret: this.twoFactorEncryption.decrypt(user.twoFactorSecret),
      role: {
        id: user.role.id,
        slug: user.role.slug,
        name: user.role.name,
        permissions: user.role.rolePermissions.map(
          (entry) => entry.permission.slug,
        ),
      },
    };
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return this.mapUser(user);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return this.mapUser(user);
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
