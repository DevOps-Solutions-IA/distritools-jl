import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import {
  loadLocalEnvFile,
  normalizeEmail,
  parseScriptArgs,
  resolvePassword,
  writeSystemAudit,
} from './admin/credential-utils';

loadLocalEnvFile();

async function main(): Promise<void> {
  const args = parseScriptArgs(process.argv.slice(2));
  const email = normalizeEmail(args.email ?? process.env.ADMIN_RESET_EMAIL ?? '');

  if (!email) {
    throw new Error('Define --email o ADMIN_RESET_EMAIL.');
  }

  const password = await resolvePassword({
    passwordEnvName: 'ADMIN_RESET_PASSWORD',
    confirmEnvName: 'ADMIN_RESET_PASSWORD_CONFIRM',
    promptLabel: 'Nueva contraseña',
  });

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: { select: { slug: true } } },
    });

    if (!user) {
      throw new Error('Usuario admin no encontrado.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hash(password, 12),
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
      action: 'admin.reset_password',
      entityType: 'user',
      entityId: user.id,
      afterData: {
        email: user.email,
        role: user.role.slug,
        sessionsRevoked: true,
      },
    });

    console.log(`Contraseña rotada para ${email}.`);
    console.log('Sesiones previas revocadas. La contraseña no fue impresa.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error inesperado';
  console.error(message);
  process.exit(1);
});
