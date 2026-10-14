import { ADMIN_PERMISSION_CATALOG } from './admin-permission-catalog';

export const SUPER_ADMIN_ROLE_SLUG = 'super-admin';
export const SUPER_ADMIN_IAM_PERMISSION_SLUGS = ADMIN_PERMISSION_CATALOG
  .filter(([, module]) => module === 'users' || module === 'roles' || module === 'permissions')
  .map(([slug]) => slug);
