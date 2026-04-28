import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleEntity } from 'src/modules/roles/domain/entities/role.entity';

@Injectable()
export class RoleIntegrityService {
  ensureRoleExists(role: RoleEntity | null): asserts role is RoleEntity {
    if (!role) {
      throw new NotFoundException('Role not found');
    }
  }

  ensureSlugAvailable(existing: RoleEntity | null, nextRoleId?: string): void {
    if (existing && existing.id !== nextRoleId) {
      throw new ConflictException('Role slug already exists');
    }
  }
}
