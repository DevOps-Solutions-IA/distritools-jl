import { ForbiddenException } from '@nestjs/common';

export function assertHasPermissions(
  actorPermissions: string[],
  requiredPermissions: string[],
): void {
  const allowed = requiredPermissions.every((permission) =>
    actorPermissions.includes(permission),
  );

  if (!allowed) {
    throw new ForbiddenException('Missing required permissions');
  }
}
