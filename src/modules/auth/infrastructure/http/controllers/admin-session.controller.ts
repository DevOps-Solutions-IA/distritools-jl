import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

@ApiTags('admin-session')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/session')
export class AdminSessionController {
  @Get()
  @Header('Cache-Control', 'private, no-store')
  session(@CurrentUserDecorator() actor: CurrentUser) {
    return {
      user: {
        id: actor.sub,
        email: actor.email,
        role: actor.role,
        permissions: [...actor.permissions],
      },
    };
  }
}
