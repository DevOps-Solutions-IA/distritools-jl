import { IAM_UNIT_OF_WORK, IamUnitOfWork } from 'src/modules/users/application/ports/iam-unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { RoleEntity } from 'src/modules/roles/domain/entities/role.entity';
import {
  ROLE_REPOSITORY,
  RoleRepository,
} from 'src/modules/roles/domain/repositories/role.repository';
import { RoleIntegrityService } from 'src/modules/roles/domain/services/role-integrity.service';

export interface CreateRoleInput {
  actor: CurrentUser;
  name: string;
  slug: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(RoleIntegrityService)
    private readonly roleIntegrityService: RoleIntegrityService,
    @Inject(IAM_UNIT_OF_WORK)
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(input: CreateRoleInput) {
    assertHasPermissions(input.actor.permissions, ['roles.create']);

    return this.unitOfWork.run(async (tx) => {
      const normalizedSlug = input.slug.trim().toLowerCase();
      const existingRole = await this.roleRepository.findBySlug(normalizedSlug, tx);

      this.roleIntegrityService.ensureSlugAvailable(
        existingRole ? RoleEntity.fromState(existingRole) : null,
      );

      const role = await this.roleRepository.create({
        id: uuidv7(),
        name: input.name.trim(),
        slug: normalizedSlug,
        description: input.description?.trim() || null,
      }, tx);

      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'roles.created',
        entityType: 'role',
        entityId: role.id,
        afterData: role,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }, tx);

      return role;
    }, { uniqueKey: `iam-role-slug:${input.slug.trim().toLowerCase()}`, authorization: { actorUserId: input.actor.sub, requiredPermissions: ['roles.create'] } });
  }
}
