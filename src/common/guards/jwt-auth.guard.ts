import { ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/common/constants/auth.constants';
import {
  createDevAdminUser,
  isDevAdminAuthDisabled,
} from 'src/common/security/dev-admin-bypass';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (isDevAdminAuthDisabled()) {
      const request = context.switchToHttp().getRequest<{ user?: unknown; ip?: string; path?: string }>();
      request.user = createDevAdminUser();
      this.logger.warn(
        `DEV AUTH BYPASS ACTIVE — request to ${request.path ?? 'unknown'} from ${request.ip ?? 'unknown'}`,
      );
      return true;
    }

    return super.canActivate(context);
  }
}
