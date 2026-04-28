import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from 'src/common/constants/auth.constants';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authenticated user context is missing');
    }

    const allowed = required.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
