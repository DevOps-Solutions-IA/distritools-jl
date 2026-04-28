export interface RoleReference {
  id: string;
  name: string;
  slug: string;
}

export interface RoleReferenceRepository {
  findById(id: string): Promise<RoleReference | null>;
}

export const ROLE_REFERENCE_REPOSITORY = Symbol('ROLE_REFERENCE_REPOSITORY');
