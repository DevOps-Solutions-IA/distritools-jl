import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  PERMISSION_REPOSITORY,
  PermissionRepository,
} from 'src/modules/permissions/domain/repositories/permission.repository';
import {
  ROLE_PERMISSION_REPOSITORY,
  RolePermissionRepository,
} from 'src/modules/permissions/domain/repositories/role-permission.repository';

export interface GetPermissionsMatrixInput {
  actor: CurrentUser;
}

@Injectable()
export class GetPermissionsMatrixUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: PermissionRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY)
    private readonly rolePermissionRepository: RolePermissionRepository,
  ) {}

  async execute(input: GetPermissionsMatrixInput) {
    assertHasPermissions(input.actor.permissions, ['permissions.read']);

    const [catalog, matrix] = await Promise.all([
      this.permissionRepository.listAll(),
      this.rolePermissionRepository.getMatrix(),
    ]);

    return {
      catalog,
      roles: matrix,
    };
  }
}
