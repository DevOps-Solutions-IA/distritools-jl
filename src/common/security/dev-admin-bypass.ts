import { CurrentUser } from 'src/common/interfaces/current-user.interface';

export const DEV_ADMIN_PERMISSIONS = [
  'users.create',
  'users.read',
  'users.update',
  'users.write',
  'users.deactivate',
  'users.disable',
  'users.reset_2fa',
  'roles.create',
  'roles.read',
  'roles.update',
  'roles.write',
  'roles.assign',
  'permissions.assign',
  'permissions.read',
  'dashboard.read',
  'reports.read',
  'reports.export',
  'reports.financial.read',
  'catalog.read',
  'catalog.write',
  'catalog.publish',
  'catalog.archive',
  'inventory.read',
  'inventory.write',
  'inventory.reserve',
  'inventory.release',
  'inventory.commit',
  'inventory.adjust',
  'inventory.return',
  'inventory.count.read',
  'inventory.count.write',
  'inventory.count.close',
  'inventory.import',
  'inventory.export',
  'inventory.cost.read',
  'inventory.cost.write',
  'inventory.alerts.read',
  'inventory.settings.write',
  'orders.read',
  'orders.write',
  'orders.status.write',
  'orders.notes.write',
  'orders.cancel',
  'orders.export',
  'quotes.read',
  'quotes.write',
  'quotes.approve',
  'quotes.convert',
  'payments.create',
  'payments.read',
  'payments.write',
  'payments.reconcile',
  'payments.refund',
  'payments.export',
  'audit.read',
  'audit.export',
  'notifications.read',
  'notifications.retry',
  'domain_events.cutover.read',
  'notifications.template.write',
  'notifications.provider.write',
  'search.reindex',
  'promotions.manage',
  'content.manage',
  'analytics.read',
  'brands.read',
  'brands.write',
  'categories.read',
  'categories.write',
  'products.read',
  'products.write',
  'products.publish',
  'products.archive',
  'variants.read',
  'variants.manage',
  'prices.read',
  'prices.write',
  'prices.approve',
  'prices.history.read',
  'shipping.read',
  'shipping.write',
  'shipping.quote',
  'shipping.create_guide',
  'shipping.download_label',
  'shipping.retry',
  'shipping.cancel',
  'shipping.pickup',
  'shipping.cod.read',
  'shipping.wallet.read',
  'shipping.issues.read',
  'shipping.issues.write',
  'shipping.returns.read',
  'tracking.read',
  'tracking.write',
  'settings.read',
  'settings.write',
  'settings.production.write',
  'customers.read',
  'customers.read_sensitive',
  'customers.notes.write',
  'customers.export',
  'legal.read',
  'legal.write',
  'legal.review',
  'legal.approve',
  'legal.publish',
  'footer.read',
  'footer.write',
  'footer.publish',
];

let cachedDevUser: CurrentUser | null = null;

export function isDevAdminAuthDisabled(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    return false;
  }

  const env = process.env.APP_ENV ?? '';

  if (env !== 'local' && env !== 'test') {
    return false;
  }

  return process.env.ADMIN_AUTH_DISABLED === 'true';
}

export function createDevAdminUser(): CurrentUser {
  if (!cachedDevUser) {
    const { v7: uuidv7 } = require('uuid');

    cachedDevUser = {
      sub: uuidv7(),
      email: 'dev-admin-bypass@distritools.local',
      role: 'dev-super-admin',
      permissions: DEV_ADMIN_PERMISSIONS,
      sessionId: uuidv7(),
    };
  }

  return cachedDevUser;
}
