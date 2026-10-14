import { IAM_UNIT_OF_WORK } from 'src/modules/users/application/ports/iam-unit-of-work.port';
import { IamPrismaUnitOfWork } from 'src/modules/users/infrastructure/transactions/iam-prisma-unit-of-work';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AssignRoleToUserUseCase } from 'src/modules/roles/application/use-cases/assign-role-to-user.use-case';
import { CreateRoleUseCase } from 'src/modules/roles/application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from 'src/modules/roles/application/use-cases/update-role.use-case';
import {
  ROLE_REPOSITORY,
} from 'src/modules/roles/domain/repositories/role.repository';
import {
  ROLE_USER_ASSIGNMENT_REPOSITORY,
} from 'src/modules/roles/domain/repositories/role-user-assignment.repository';
import { RoleIntegrityService } from 'src/modules/roles/domain/services/role-integrity.service';
import { RolesController } from 'src/modules/roles/infrastructure/http/controllers/roles.controller';
import { PrismaRoleRepository } from 'src/modules/roles/infrastructure/repositories/prisma-role.repository';
import { PrismaRoleUserAssignmentRepository } from 'src/modules/roles/infrastructure/repositories/prisma-role-user-assignment.repository';

@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [
    { provide: IAM_UNIT_OF_WORK, useClass: IamPrismaUnitOfWork },
    CreateRoleUseCase,
    UpdateRoleUseCase,
    AssignRoleToUserUseCase,
    RoleIntegrityService,
    PrismaRoleRepository,
    PrismaRoleUserAssignmentRepository,
    {
      provide: ROLE_REPOSITORY,
      useExisting: PrismaRoleRepository,
    },
    {
      provide: ROLE_USER_ASSIGNMENT_REPOSITORY,
      useExisting: PrismaRoleUserAssignmentRepository,
    },
  ],
})
export class RolesModule {}
