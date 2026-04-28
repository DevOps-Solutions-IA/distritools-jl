import { RoleState } from 'src/modules/roles/domain/entities/role.entity';

export interface CreateRoleRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateRoleRecord {
  id: string;
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface RoleRepository {
  findById(id: string): Promise<RoleState | null>;
  findBySlug(slug: string): Promise<RoleState | null>;
  create(data: CreateRoleRecord): Promise<RoleState>;
  update(data: UpdateRoleRecord): Promise<RoleState>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
