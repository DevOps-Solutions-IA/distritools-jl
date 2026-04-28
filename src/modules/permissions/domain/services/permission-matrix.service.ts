import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionCatalogEntry } from 'src/modules/permissions/domain/repositories/permission.repository';
import { PermissionRoleReference } from 'src/modules/permissions/domain/repositories/permission-role-reference.repository';

@Injectable()
export class PermissionMatrixService {
  ensureRoleExists(
    role: PermissionRoleReference | null,
  ): asserts role is PermissionRoleReference {
    if (!role) {
      throw new NotFoundException('Role not found');
    }
  }

  ensurePermissionCatalogCompleteness(
    requestedSlugs: string[],
    catalogEntries: PermissionCatalogEntry[],
  ): void {
    const existing = new Set(catalogEntries.map((entry) => entry.slug));
    const missing = requestedSlugs.filter((slug) => !existing.has(slug));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown permissions requested: ${missing.join(', ')}`,
      );
    }
  }
}
