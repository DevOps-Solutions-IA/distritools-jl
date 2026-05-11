import { PrismaClient } from '@prisma/client';
import { generateSecret } from 'otplib';
import {
  loadLocalEnvFile,
  normalizeEmail,
  parseScriptArgs,
  writeSystemAudit,
  writeTotpSetupFile,
} from './admin/credential-utils';

loadLocalEnvFile();

async function main(): Promise<void> {
  const args = parseScriptArgs(process.argv.slice(2));
  const email = normalizeEmail(args.email ?? process.env.ADMIN_RESET_EMAIL ?? '');

  if (!email) {
    throw new Error('Define --email o ADMIN_RESET_EMAIL.');
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: { select: { slug: true } } },
    });

    if (!user) {
      throw new Error('Usuario admin no encontrado.');
    }

    const secret = process.env.ADMIN_RESET_TOTP_SECRET ?? generateSecret();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret,
          isActive: true,
        },
      }),
      prisma.authSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          compromisedAt: new Date(),
        },
      }),
    ]);

    await writeSystemAudit(prisma, {
      action: 'admin.reset_2fa',
      entityType: 'user',
      entityId: user.id,
      afterData: {
        email: user.email,
        role: user.role.slug,
        twoFactorConfigured: true,
        sessionsRevoked: true,
      },
    });

    const setupFile = writeTotpSetupFile(email, secret, 'reset-2fa');
    console.log(`2FA rotado para ${email}.`);
    console.log(`Archivo local 2FA creado con permisos 0600: ${setupFile}`);
    console.log('Sesiones previas revocadas. El secreto no fue impreso en consola.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error inesperado';
  console.error(message);
  process.exit(1);
});
