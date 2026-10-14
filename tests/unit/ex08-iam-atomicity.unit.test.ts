import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { IamUnitOfWork } from 'src/modules/users/application/ports/iam-unit-of-work.port';
import { CreateAdminUserUseCase } from 'src/modules/users/application/use-cases/create-admin-user.use-case';
import { UpdateAdminUserUseCase } from 'src/modules/users/application/use-cases/update-admin-user.use-case';
import { DeactivateAdminUserUseCase } from 'src/modules/users/application/use-cases/deactivate-admin-user.use-case';
import { CreateRoleUseCase } from 'src/modules/roles/application/use-cases/create-role.use-case';
import { AssignRoleToUserUseCase } from 'src/modules/roles/application/use-cases/assign-role-to-user.use-case';
import { AssignPermissionsToRoleUseCase } from 'src/modules/permissions/application/use-cases/assign-permissions-to-role.use-case';

const actor = { sub: '01900000-0000-7000-8000-000000000001', permissions: [] } as unknown as CurrentUser;
const untouched = {} as never;
function forbiddenTransaction(): IamUnitOfWork {
  return { run: async () => { throw new Error('Unauthorized mutation reached database'); } };
}
describe('EX08 IAM atomic boundary authorization', () => {
  it('rejects user creation before database access', async () => {
    const useCase = new CreateAdminUserUseCase(untouched, untouched, untouched, untouched, untouched, forbiddenTransaction());
    await assert.rejects(useCase.execute({ actor, fullName: 'Name', email: 'x@example.test', password: 'unused', roleId: actor.sub }), ForbiddenException);
  });
  it('rejects user update before database access', async () => {
    const useCase = new UpdateAdminUserUseCase(untouched, untouched, untouched, untouched, untouched, forbiddenTransaction());
    await assert.rejects(useCase.execute({ actor, userId: actor.sub, fullName: 'Name' }), ForbiddenException);
  });
  it('rejects user deactivation before database access', async () => {
    const useCase = new DeactivateAdminUserUseCase(untouched, untouched, forbiddenTransaction());
    await assert.rejects(useCase.execute({ actor, userId: actor.sub }), ForbiddenException);
  });
  it('rejects role creation before database access', async () => {
    const useCase = new CreateRoleUseCase(untouched, untouched, untouched, forbiddenTransaction());
    await assert.rejects(useCase.execute({ actor, name: 'Name', slug: 'slug' }), ForbiddenException);
  });
  it('rejects role assignment before database access', async () => {
    const useCase = new AssignRoleToUserUseCase(untouched, untouched, untouched, untouched, forbiddenTransaction());
    await assert.rejects(useCase.execute({ actor, roleId: actor.sub, userId: actor.sub }), ForbiddenException);
  });
  it('rejects permission assignment before database access', async () => {
    const useCase = new AssignPermissionsToRoleUseCase(untouched, untouched, untouched, untouched, untouched, forbiddenTransaction());
    await assert.rejects(useCase.execute({ actor, roleId: actor.sub, permissionSlugs: ['users.read'] }), ForbiddenException);
  });
});
