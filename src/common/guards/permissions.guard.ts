import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { v7 as uuidv7 } from 'uuid';
import { PERMISSIONS_KEY } from 'src/common/constants/auth.constants';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: CurrentUser;
      ip?: string;
      method?: string;
      path?: string;
      headers?: Record<string, string>;
    }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authenticated user context is missing');
    }

    const allowed = required.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!allowed) {
      const auditEntry = {
        actorUserId: user.sub,
        action: 'auth.permission_denied',
        entityType: 'route',
        entityId: `${request.method ?? '?'} ${request.path ?? '?'}`,
        ipAddress: request.ip ?? null,
        userAgent: request.headers?.['user-agent'] ?? null,
        afterData: {
          requiredPermissions: required,
          userPermissions: user.permissions,
          method: request.method,
          path: request.path,
        },
      };

      this.logger.warn(
        `Permission denied for user ${user.email} (${user.sub}) on ${request.method} ${request.path}. Required: [${required.join(', ')}]`,
      );

      this.prisma.auditLog.create({
        data: {
          id: uuidv7(),
          ...auditEntry,
        },
      }).catch((err: unknown) => {
        this.logger.error('Failed to write permission-denied audit log', err instanceof Error ? err.stack : String(err));
      });

      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
