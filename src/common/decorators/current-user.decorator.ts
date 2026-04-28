import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

export const CurrentUserDecorator = createParamDecorator(
  (_: unknown, context: ExecutionContext): CurrentUser | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    return request.user;
  },
);
