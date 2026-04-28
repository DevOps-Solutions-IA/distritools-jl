import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AssignPermissionsToRoleUseCase } from 'src/modules/permissions/application/use-cases/assign-permissions-to-role.use-case';
import { GetPermissionsMatrixUseCase } from 'src/modules/permissions/application/use-cases/get-permissions-matrix.use-case';
import {
  PERMISSION_REPOSITORY,
} from 'src/modules/permissions/domain/repositories/permission.repository';
import {
  PERMISSION_ROLE_REFERENCE_REPOSITORY,
} from 'src/modules/permissions/domain/repositories/permission-role-reference.repository';
import {
  ROLE_PERMISSION_REPOSITORY,
} from 'src/modules/permissions/domain/repositories/role-permission.repository';
import { PermissionMatrixService } from 'src/modules/permissions/domain/services/permission-matrix.service';
import { PermissionsController } from 'src/modules/permissions/infrastructure/http/controllers/permissions.controller';
import { PrismaPermissionRepository } from 'src/modules/permissions/infrastructure/repositories/prisma-permission.repository';
import { PrismaPermissionRoleReferenceRepository } from 'src/modules/permissions/infrastructure/repositories/prisma-permission-role-reference.repository';
import { PrismaRolePermissionRepository } from 'src/modules/permissions/infrastructure/repositories/prisma-role-permission.repository';

@Module({
  imports: [AuthModule],
  controllers: [PermissionsController],
  providers: [
    AssignPermissionsToRoleUseCase,
    GetPermissionsMatrixUseCase,
    PermissionMatrixService,
    PrismaPermissionRepository,
    PrismaRolePermissionRepository,
    PrismaPermissionRoleReferenceRepository,
    {
      provide: PERMISSION_REPOSITORY,
      useExisting: PrismaPermissionRepository,
    },
    {
      provide: ROLE_PERMISSION_REPOSITORY,
      useExisting: PrismaRolePermissionRepository,
    },
    {
      provide: PERMISSION_ROLE_REFERENCE_REPOSITORY,
      useExisting: PrismaPermissionRoleReferenceRepository,
    },
  ],
})
export class PermissionsModule {}
