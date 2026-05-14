import fs from 'node:fs';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

export const SUPER_ADMIN_ROLE_SLUG = 'super-admin';

export const ADMIN_PERMISSION_CATALOG = [
  ['users.create', 'users'],
  ['users.read', 'users'],
  ['users.update', 'users'],
  ['users.deactivate', 'users'],
  ['roles.create', 'roles'],
  ['roles.update', 'roles'],
  ['roles.assign', 'roles'],
  ['permissions.assign', 'permissions'],
  ['permissions.read', 'permissions'],
  ['inventory.read', 'inventory'],
  ['inventory.reserve', 'inventory'],
  ['inventory.release', 'inventory'],
  ['inventory.commit', 'inventory'],
  ['inventory.adjust', 'inventory'],
  ['inventory.return', 'inventory'],
  ['inventory.count.read', 'inventory'],
  ['inventory.count.write', 'inventory'],
  ['inventory.count.close', 'inventory'],
  ['inventory.import', 'inventory'],
  ['inventory.export', 'inventory'],
  ['inventory.cost.read', 'inventory'],
  ['inventory.cost.write', 'inventory'],
  ['inventory.alerts.read', 'inventory'],
  ['inventory.settings.write', 'inventory'],
  ['orders.read', 'orders'],
  ['orders.write', 'orders'],
  ['orders.cancel', 'orders'],
  ['payments.create', 'payments'],
  ['payments.read', 'payments'],
  ['audit.read', 'audit'],
  ['notifications.read', 'notifications'],
  ['notifications.retry', 'notifications'],
  ['search.reindex', 'search'],
  ['promotions.manage', 'promotions'],
  ['content.manage', 'content'],
  ['analytics.read', 'analytics'],
  ['brands.read', 'brands'],
  ['brands.manage', 'brands'],
  ['categories.read', 'categories'],
  ['categories.manage', 'categories'],
  ['products.read', 'products'],
  ['products.manage', 'products'],
  ['variants.read', 'variants'],
  ['variants.manage', 'variants'],
  ['shipping.read', 'shipping'],
  ['shipping.write', 'shipping'],
  ['shipping.quote', 'shipping'],
  ['shipping.create_guide', 'shipping'],
  ['shipping.download_label', 'shipping'],
  ['shipping.retry', 'shipping'],
  ['shipping.cancel', 'shipping'],
  ['shipping.pickup', 'shipping'],
  ['shipping.cod.read', 'shipping'],
  ['shipping.wallet.read', 'shipping'],
  ['shipping.issues.read', 'shipping'],
  ['shipping.issues.write', 'shipping'],
  ['shipping.returns.read', 'shipping'],
  ['tracking.read', 'shipping'],
  ['tracking.write', 'shipping'],
  ['settings.read', 'settings'],
  ['settings.write', 'settings'],
] as const;

export type AdminPermissionSlug = (typeof ADMIN_PERMISSION_CATALOG)[number][0];

export interface ParsedArgs {
  email?: string;
  force: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  reasons: string[];
}

export function loadLocalEnvFile(filePath = path.resolve(process.cwd(), '.env')): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function parseScriptArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { force: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--force') {
      parsed.force = true;
      continue;
    }

    if (arg === '--email') {
      parsed.email = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--email=')) {
      parsed.email = arg.slice('--email='.length);
    }
  }

  return parsed;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateAdminPassword(password: string): PasswordValidationResult {
  const reasons: string[] = [];
  const lower = password.toLowerCase();

  if (password.length < 12) {
    reasons.push('mínimo 12 caracteres');
  }

  if (!/[a-z]/.test(password)) {
    reasons.push('una minúscula');
  }

  if (!/[A-Z]/.test(password)) {
    reasons.push('una mayúscula');
  }

  if (!/\d/.test(password)) {
    reasons.push('un número');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    reasons.push('un símbolo');
  }

  if (
    lower === 'admin' ||
    lower === 'admin123' ||
    lower.includes('password') ||
    lower.includes('changeme')
  ) {
    reasons.push('no usar credenciales débiles o de ejemplo');
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export async function promptHidden(label: string): Promise<string> {
  if (!input.isTTY) {
    throw new Error(`${label} debe venir por variable de entorno en ejecución no interactiva.`);
  }

  const readline = createInterface({ input, output });
  const mutedOutput = output.write.bind(output);

  output.write = ((chunk: string | Uint8Array): boolean => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString();

    if (text.includes(label)) {
      return mutedOutput(chunk);
    }

    return true;
  }) as typeof output.write;

  try {
    const value = await readline.question(`${label}: `);
    mutedOutput('\n');
    return value;
  } finally {
    output.write = mutedOutput as typeof output.write;
    readline.close();
  }
}

export async function resolvePassword(options: {
  passwordEnvName: string;
  confirmEnvName?: string;
  promptLabel: string;
}): Promise<string> {
  const password = process.env[options.passwordEnvName] ?? await promptHidden(options.promptLabel);
  const confirmation =
    process.env[options.confirmEnvName ?? `${options.passwordEnvName}_CONFIRM`] ??
    await promptHidden('Confirmar contraseña');

  if (password !== confirmation) {
    throw new Error('La confirmación de contraseña no coincide.');
  }

  const validation = validateAdminPassword(password);

  if (!validation.valid) {
    throw new Error(`La contraseña no cumple política: ${validation.reasons.join(', ')}.`);
  }

  return password;
}

export function assertProductionBootstrapSafety(email: string): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (process.env.CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP !== 'YES') {
    throw new Error('Bootstrap productivo requiere CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP=YES.');
  }

  if (email.endsWith('.local') || email.includes('@example.') || email.includes('@test.')) {
    throw new Error('Bootstrap productivo no permite dominios locales o de ejemplo.');
  }
}

export async function ensurePermissionCatalog(prisma: PrismaClient): Promise<string[]> {
  const permissionIds: string[] = [];

  for (const [slug, module] of ADMIN_PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { slug },
      update: {
        module,
        name: slug,
        description: `${slug} permission`,
      },
      create: {
        id: uuidv7(),
        name: slug,
        slug,
        module,
        description: `${slug} permission`,
      },
    });

    permissionIds.push(permission.id);
  }

  return permissionIds;
}

export async function ensureSuperAdminRole(prisma: PrismaClient): Promise<string> {
  const role = await prisma.role.upsert({
    where: { slug: SUPER_ADMIN_ROLE_SLUG },
    update: {
      name: 'Super Admin',
      description: 'Full access',
    },
    create: {
      id: uuidv7(),
      name: 'Super Admin',
      slug: SUPER_ADMIN_ROLE_SLUG,
      description: 'Full access',
    },
  });

  const permissionIds = await ensurePermissionCatalog(prisma);

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId,
        },
      },
      update: {},
      create: {
        id: uuidv7(),
        roleId: role.id,
        permissionId,
      },
    });
  }

  return role.id;
}

export async function writeSystemAudit(prisma: PrismaClient, input: {
  action: string;
  entityType: string;
  entityId: string;
  afterData?: Record<string, string | boolean | number | null>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      id: uuidv7(),
      actorUserId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      afterData: input.afterData ?? undefined,
    },
  });
}

export function writeTotpSetupFile(email: string, secret: string, purpose: string): string {
  const directory = path.resolve(process.cwd(), 'tmp', 'admin-credentials');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

  const safeEmail = email.replace(/[^a-z0-9._-]/gi, '_');
  const filePath = path.join(directory, `${purpose}-${safeEmail}.txt`);
  const label = `DistriTools JL:${email}`;
  const otpauthUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent('DistriTools JL')}`;

  fs.writeFileSync(
    filePath,
    [
      'Archivo local temporal de enrolamiento 2FA.',
      'No versionar. No compartir por chat. Eliminar después de registrar el autenticador.',
      '',
      `Email: ${email}`,
      `Issuer: DistriTools JL`,
      `Secret: ${secret}`,
      `URI: ${otpauthUri}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  fs.chmodSync(filePath, 0o600);

  return filePath;
}
