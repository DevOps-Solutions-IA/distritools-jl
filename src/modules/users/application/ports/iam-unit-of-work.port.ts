import type { Prisma } from '@prisma/client';

export const IAM_UNIT_OF_WORK = Symbol('IAM_UNIT_OF_WORK');

export interface IamMutationLock {
  userId?: string;
  roleId?: string;
  uniqueKey?: string;
  authorization?: {
    actorUserId: string;
    requiredPermissions: string[];
  };
  protection?: {
    operation: string;
    entityType: 'user' | 'role';
    entityId: string;
    userId?: string;
    nextRoleId?: string;
    roleId?: string;
    nextSlug?: string;
    permissionSlugs?: string[];
    selfDeactivate?: boolean;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface IamUnitOfWork {
  run<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, lock?: IamMutationLock): Promise<T>;
}
