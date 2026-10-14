import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { IamMutationLock, IamUnitOfWork } from 'src/modules/users/application/ports/iam-unit-of-work.port';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { SUPER_ADMIN_IAM_PERMISSION_SLUGS, SUPER_ADMIN_ROLE_SLUG } from 'src/common/security/super-admin-role.constants';
import type { Prisma } from '@prisma/client';

@Injectable()
export class IamPrismaUnitOfWork implements IamUnitOfWork {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async run<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, lock: IamMutationLock = {}): Promise<T> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      // One database lock serializes every IAM UOW, including creation/repair,
      // across processes. Always acquire it before per-resource locks.
      const invariantKey = 'iam:last-active-super-admin';
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invariantKey}, 0))`;
      if (lock.uniqueKey) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock.uniqueKey}, 0))`;
      }
      if (lock.userId) {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${lock.userId}::uuid FOR UPDATE`;
      }
      if (lock.roleId) {
        await tx.$queryRaw`SELECT id FROM roles WHERE id = ${lock.roleId}::uuid FOR UPDATE`;
      }
      if (lock.authorization) {
        const actor = await tx.user.findUnique({
          where: { id: lock.authorization.actorUserId },
          select: { isActive: true, role: { select: { rolePermissions: { select: { permission: { select: { slug: true } } } } } } },
        });
        const currentPermissions = actor?.role.rolePermissions.map((p) => p.permission.slug) ?? [];
        if (!actor?.isActive || !lock.authorization.requiredPermissions.every((p) => currentPermissions.includes(p))) {
          throw new ForbiddenException('Current actor no longer has required permissions');
        }
      }
      const reason = await this.denialReason(tx, lock.protection);
      if (reason && lock.protection) {
        await this.auditRepository.write({
          actorUserId: lock.authorization?.actorUserId,
          action: 'iam.mutation.denied',
          entityType: lock.protection.entityType,
          entityId: lock.protection.entityId,
          afterData: { operation: lock.protection.operation, reason },
          ipAddress: lock.protection.ipAddress,
          userAgent: lock.protection.userAgent,
        }, tx);
        return { denied: true as const, reason };
      }
      return { denied: false as const, value: await operation(tx) };
    });
    // Throw only after committing the denial audit. Any audit failure instead
    // rejects the transaction and rolls back all its writes.
    if (outcome.denied) {
      throw new ConflictException(outcome.reason === 'SELF_DEACTIVATION'
        ? 'Admins cannot deactivate themselves'
        : 'Cannot remove the last active superadministrator IAM access');
    }
    return outcome.value;
  }

  private async denialReason(tx: Prisma.TransactionClient, protection?: IamMutationLock['protection']): Promise<string | null> {
    if (!protection) return null;
    const canonical = await tx.role.findUnique({
      where: { slug: SUPER_ADMIN_ROLE_SLUG },
      select: {
        id: true,
        users: { where: { isActive: true }, select: { id: true } },
        rolePermissions: { select: { permission: { select: { slug: true } } } },
      },
    });
    const grants = canonical?.rolePermissions.map((p) => p.permission.slug) ?? [];
    const effective = canonical && SUPER_ADMIN_IAM_PERMISSION_SLUGS.every((slug) => grants.includes(slug))
      ? canonical.users : [];
    if (canonical && effective.length > 0) {
      const targetIsLast = effective.length === 1 && effective[0].id === protection.userId;
      if (targetIsLast && protection.operation === 'users.admin.deactivated') return 'LAST_ACTIVE_SUPER_ADMIN';
      if (targetIsLast && protection.nextRoleId && protection.nextRoleId !== canonical.id) {
        // Preserve existing invalid-target validation before classifying loss.
        if (await tx.role.findUnique({ where: { id: protection.nextRoleId }, select: { id: true } })) return 'LAST_ACTIVE_SUPER_ADMIN';
      }
      if (protection.roleId === canonical.id && protection.nextSlug !== undefined && protection.nextSlug !== SUPER_ADMIN_ROLE_SLUG) {
        if (!await tx.role.findUnique({ where: { slug: protection.nextSlug }, select: { id: true } })) return 'LAST_ACTIVE_SUPER_ADMIN';
      }
      if (protection.roleId === canonical.id && protection.permissionSlugs && !SUPER_ADMIN_IAM_PERMISSION_SLUGS.every((slug) => protection.permissionSlugs?.includes(slug))) {
        const known = await tx.permission.count({ where: { slug: { in: protection.permissionSlugs } } });
        if (known === protection.permissionSlugs.length) return 'LAST_ACTIVE_SUPER_ADMIN';
      }
    }
    return protection.selfDeactivate ? 'SELF_DEACTIVATION' : null;
  }
}
