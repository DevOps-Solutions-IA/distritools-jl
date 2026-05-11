import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { generateSecret } from 'otplib';
import { v7 as uuidv7 } from 'uuid';
import {
  assertProductionBootstrapSafety,
  ensureSuperAdminRole,
  loadLocalEnvFile,
  normalizeEmail,
  parseScriptArgs,
  resolvePassword,
  SUPER_ADMIN_ROLE_SLUG,
  writeTotpSetupFile,
  writeSystemAudit,
} from './admin/credential-utils';

loadLocalEnvFile();

async function main(): Promise<void> {
  const args = parseScriptArgs(process.argv.slice(2));
  const email = normalizeEmail(
    args.email ?? process.env.ADMIN_BOOTSTRAP_EMAIL ?? '',
  );

  if (!email) {
    throw new Error('Define ADMIN_BOOTSTRAP_EMAIL o usa --email.');
  }

  assertProductionBootstrapSafety(email);

  const password = await resolvePassword({
    passwordEnvName: 'ADMIN_BOOTSTRAP_PASSWORD',
    confirmEnvName: 'ADMIN_BOOTSTRAP_PASSWORD_CONFIRM',
    promptLabel: 'Contraseña inicial',
  });

  const prisma = new PrismaClient();

  try {
    const existingSuperAdmin = await prisma.user.findFirst({
      where: {
        role: { slug: SUPER_ADMIN_ROLE_SLUG },
        isActive: true,
      },
      select: { email: true },
    });

    if (existingSuperAdmin && !args.force) {
      throw new Error(
        'Ya existe un SUPER_ADMIN activo. Usa admin:reset-password para rotar credenciales.',
      );
    }

    const roleId = await ensureSuperAdminRole(prisma);
    const require2FA = process.env.ADMIN_BOOTSTRAP_REQUIRE_2FA !== 'false';

    if (!require2FA) {
      throw new Error(
        'El login admin actual exige 2FA. Ejecuta bootstrap con ADMIN_BOOTSTRAP_REQUIRE_2FA=true u omite la variable.',
      );
    }

    const generatedTwoFactorSecret =
      require2FA && !process.env.ADMIN_BOOTSTRAP_TOTP_SECRET;
    const twoFactorSecret = require2FA
      ? process.env.ADMIN_BOOTSTRAP_TOTP_SECRET ?? generateSecret()
      : null;
    const userId = uuidv7();

    await prisma.user.upsert({
      where: { email },
      update: {
        fullName: process.env.ADMIN_BOOTSTRAP_FULL_NAME ?? 'Super Admin',
        passwordHash: await hash(password, 12),
        roleId,
        isActive: true,
        twoFactorSecret,
      },
      create: {
        id: userId,
        fullName: process.env.ADMIN_BOOTSTRAP_FULL_NAME ?? 'Super Admin',
        email,
        passwordHash: await hash(password, 12),
        roleId,
        isActive: true,
        twoFactorSecret,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    await writeSystemAudit(prisma, {
      action: 'admin.bootstrap_super_admin',
      entityType: 'user',
      entityId: user.id,
      afterData: {
        email,
        role: SUPER_ADMIN_ROLE_SLUG,
        active: true,
        twoFactorConfigured: Boolean(twoFactorSecret),
      },
    });

    console.log(`SUPER_ADMIN listo para ${email}.`);
    console.log('Contraseña no impresa. Hash almacenado con bcrypt.');
    console.log(`2FA configurado: ${Boolean(twoFactorSecret) ? 'sí' : 'no'}.`);
    if (twoFactorSecret && generatedTwoFactorSecret) {
      const setupFile = writeTotpSetupFile(email, twoFactorSecret, 'bootstrap-2fa');
      console.log(`Archivo local 2FA creado con permisos 0600: ${setupFile}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error inesperado';
  console.error(message);
  process.exit(1);
});
