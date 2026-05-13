import 'tests/helpers/test-env';

import { generateSecret } from 'otplib';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { seedBrandTaxonomy } from 'src/modules/brands/infrastructure/seeds/brand-taxonomy.seed';
import { seedCategoryTaxonomy } from 'src/modules/categories/infrastructure/seeds/category-taxonomy.seed';
import { seedMasterProductCatalog } from 'src/modules/products/infrastructure/seeds/master-product-catalog.seed';
import { v7 as uuidv7 } from 'uuid';

export const prisma = new PrismaClient();
const RESET_RETRYABLE_ERROR_CODES = new Set(['40P01', '55P03']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPrismaErrorCode(error: unknown): string | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  if (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    typeof error.message === 'string'
  ) {
    const match = error.message.match(/Code:\s*`([^`]+)`/);
    return match?.[1] ?? null;
  }

  if (error instanceof Error) {
    const match = error.message.match(/Code:\s*`([^`]+)`/);
    return match?.[1] ?? null;
  }

  return null;
}

export const permissionCatalog = [
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

export async function resetDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      `;

      if (tables.length === 0) {
        return;
      }

      const tableList = tables
        .map((table) => `"public"."${table.tablename}"`)
        .join(', ');

      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
      return;
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (!code || !RESET_RETRYABLE_ERROR_CODES.has(code) || attempt === 8) {
        throw error;
      }

      await sleep(100 * attempt);
    }
  }
}

export async function seedBaseData() {
  await seedCategoryTaxonomy(prisma);
  const seededBrands = await seedBrandTaxonomy(prisma);

  const permissionIds = new Map<string, string>();

  for (const [slug, module] of permissionCatalog) {
    const id = uuidv7();
    permissionIds.set(slug, id);
    await prisma.permission.create({
      data: {
        id,
        name: slug,
        slug,
        module,
        description: `${slug} permission`,
      },
    });
  }

  const superAdminRoleId = uuidv7();
  const limitedRoleId = uuidv7();

  await prisma.role.createMany({
    data: [
      {
        id: superAdminRoleId,
        name: 'Super Admin',
        slug: 'super-admin',
        description: 'Full access',
      },
      {
        id: limitedRoleId,
        name: 'Viewer',
        slug: 'viewer',
        description: 'Limited access',
      },
    ],
  });

  await prisma.rolePermission.createMany({
    data: [
      ...permissionCatalog.map(([slug]) => ({
        id: uuidv7(),
        roleId: superAdminRoleId,
        permissionId: permissionIds.get(slug)!,
      })),
      {
        id: uuidv7(),
        roleId: limitedRoleId,
        permissionId: permissionIds.get('inventory.read')!,
      },
    ],
  });

  const twoFactorSecret = generateSecret();
  const adminPassword = 'AdminPass123!';
  const viewerPassword = 'ViewerPass123!';

  const adminUserId = uuidv7();
  const viewerUserId = uuidv7();

  await prisma.user.createMany({
    data: [
      {
        id: adminUserId,
        fullName: 'Admin User',
        email: 'admin@distritools.local',
        passwordHash: await hash(adminPassword, 12),
        phone: '3000000000',
        roleId: superAdminRoleId,
        isActive: true,
        twoFactorSecret,
      },
      {
        id: viewerUserId,
        fullName: 'Viewer User',
        email: 'viewer@distritools.local',
        passwordHash: await hash(viewerPassword, 12),
        phone: '3000000001',
        roleId: limitedRoleId,
        isActive: true,
        twoFactorSecret,
      },
    ],
  });

  const warehouseId = uuidv7();

  await prisma.warehouse.create({
    data: {
      id: warehouseId,
      name: 'Main Warehouse',
      location: 'Cali',
      isActive: true,
    },
  });

  await seedMasterProductCatalog(prisma, { warehouseId });

  const totalBrand = seededBrands.find((brand) => brand.slug === 'total');
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: 'herramientas-electricas' },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { slug: 'taladro-percutor-1-2-total' },
    include: { variants: true },
  });
  const secondProduct = await prisma.product.findUniqueOrThrow({
    where: { slug: 'esmeril-angular-4-1-2-total' },
    include: { variants: true },
  });
  const variant = product.variants[0];
  const secondVariant = secondProduct.variants[0];

  if (!variant || !secondVariant) {
    throw new Error('El catálogo maestro no creó las variantes base de TOTAL.');
  }

  return {
    roles: {
      superAdminRoleId,
      limitedRoleId,
    },
      users: {
      adminUserId,
      viewerUserId,
      adminEmail: 'admin@distritools.local',
      viewerEmail: 'viewer@distritools.local',
      adminPassword,
      viewerPassword,
      twoFactorSecret,
    },
      inventory: {
        warehouseId,
        brandId: totalBrand?.id ?? null,
        categoryId: category.id,
        productId: product.id,
        secondProductId: secondProduct.id,
        variantId: variant.id,
        secondVariantId: secondVariant.id,
    },
  };
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
