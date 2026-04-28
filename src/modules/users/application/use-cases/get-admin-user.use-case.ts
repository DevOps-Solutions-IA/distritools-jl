import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { AdminUserEntity } from 'src/modules/users/domain/entities/admin-user.entity';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from 'src/modules/users/domain/repositories/admin-user.repository';

export interface GetAdminUserInput {
  actor: CurrentUser;
  userId: string;
}

@Injectable()
export class GetAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminUserRepository: AdminUserRepository,
  ) {}

  async execute(input: GetAdminUserInput) {
    assertHasPermissions(input.actor.permissions, ['users.read']);

    const record = await this.adminUserRepository.findById(input.userId);

    if (!record) {
      throw new NotFoundException('Admin user not found');
    }

    return AdminUserEntity.fromState(record).toResponse();
  }
}
