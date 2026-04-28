import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CreateAdminUserUseCase } from 'src/modules/users/application/use-cases/create-admin-user.use-case';
import { DeactivateAdminUserUseCase } from 'src/modules/users/application/use-cases/deactivate-admin-user.use-case';
import { GetAdminUserUseCase } from 'src/modules/users/application/use-cases/get-admin-user.use-case';
import { UpdateAdminUserUseCase } from 'src/modules/users/application/use-cases/update-admin-user.use-case';
import {
  ADMIN_USER_REPOSITORY,
} from 'src/modules/users/domain/repositories/admin-user.repository';
import {
  ROLE_REFERENCE_REPOSITORY,
} from 'src/modules/users/domain/repositories/role-reference.repository';
import { PasswordHashingService } from 'src/modules/users/domain/services/password-hashing.service';
import { UserPolicyService } from 'src/modules/users/domain/services/user-policy.service';
import { UsersController } from 'src/modules/users/infrastructure/http/controllers/users.controller';
import { PrismaAdminUserRepository } from 'src/modules/users/infrastructure/repositories/prisma-admin-user.repository';
import { PrismaRoleReferenceRepository } from 'src/modules/users/infrastructure/repositories/prisma-role-reference.repository';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    CreateAdminUserUseCase,
    UpdateAdminUserUseCase,
    DeactivateAdminUserUseCase,
    GetAdminUserUseCase,
    PasswordHashingService,
    UserPolicyService,
    PrismaAdminUserRepository,
    PrismaRoleReferenceRepository,
    {
      provide: ADMIN_USER_REPOSITORY,
      useExisting: PrismaAdminUserRepository,
    },
    {
      provide: ROLE_REFERENCE_REPOSITORY,
      useExisting: PrismaRoleReferenceRepository,
    },
  ],
})
export class UsersModule {}
