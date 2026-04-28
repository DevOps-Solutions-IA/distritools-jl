export interface PermissionRoleReference {
  id: string;
  name: string;
  slug: string;
}

export interface PermissionRoleReferenceRepository {
  findRoleById(roleId: string): Promise<PermissionRoleReference | null>;
}

export const PERMISSION_ROLE_REFERENCE_REPOSITORY = Symbol(
  'PERMISSION_ROLE_REFERENCE_REPOSITORY',
);
