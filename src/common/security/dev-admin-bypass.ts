import { CurrentUser } from 'src/common/interfaces/current-user.interface';

export const DEV_ADMIN_PERMISSIONS = [
  'users.create',
  'users.read',
  'users.update',
  'users.deactivate',
  'roles.create',
  'roles.update',
  'roles.assign',
  'permissions.assign',
  'permissions.read',
  'inventory.read',
  'inventory.reserve',
  'inventory.release',
  'inventory.commit',
  'inventory.adjust',
  'orders.read',
  'orders.write',
  'orders.cancel',
  'payments.create',
  'payments.read',
  'audit.read',
  'notifications.read',
  'notifications.retry',
  'search.reindex',
  'promotions.manage',
  'content.manage',
  'analytics.read',
  'brands.read',
  'brands.manage',
  'categories.read',
  'categories.manage',
  'products.read',
  'products.manage',
  'variants.read',
  'variants.manage',
  'shipping.read',
  'shipping.write',
  'shipping.cancel',
  'shipping.pickup',
  'shipping.cod.read',
  'shipping.wallet.read',
  'shipping.issues.write',
  'shipping.returns.read',
  'tracking.read',
  'tracking.write',
  'settings.read',
  'settings.write',
];

export function isDevAdminAuthDisabled(): boolean {
  return process.env.APP_ENV !== 'production' && process.env.ADMIN_AUTH_DISABLED === 'true';
}

export function createDevAdminUser(): CurrentUser {
  return {
    sub: '00000000-0000-7000-8000-000000000099',
    email: 'dev-admin-bypass@distritools.local',
    role: 'dev-super-admin',
    permissions: DEV_ADMIN_PERMISSIONS,
    sessionId: 'dev-admin-bypass-session',
  };
}
