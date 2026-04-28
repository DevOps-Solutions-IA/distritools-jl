export interface RolePermissionMatrixRow {
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: string[];
}

export interface ReplaceRolePermissionsInput {
  roleId: string;
  permissionIds: string[];
}

export interface RolePermissionRepository {
  replaceForRole(input: ReplaceRolePermissionsInput): Promise<void>;
  getMatrix(): Promise<RolePermissionMatrixRow[]>;
}

export const ROLE_PERMISSION_REPOSITORY = Symbol('ROLE_PERMISSION_REPOSITORY');
