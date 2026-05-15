import {
  Body,
  Controller,
  Headers,
  Inject,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { LoginAdminUseCase } from 'src/modules/auth/application/use-cases/login-admin.use-case';
import { LogoutUseCase } from 'src/modules/auth/application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from 'src/modules/auth/application/use-cases/refresh-token.use-case';
import { VerifyTwoFactorUseCase } from 'src/modules/auth/application/use-cases/verify-two-factor.use-case';
import { LoginAdminRequestDto } from 'src/modules/auth/infrastructure/http/dto/login-admin.request.dto';
import { RefreshTokenRequestDto } from 'src/modules/auth/infrastructure/http/dto/refresh-token.request.dto';
import { VerifyTwoFactorRequestDto } from 'src/modules/auth/infrastructure/http/dto/verify-two-factor.request.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LoginAdminUseCase)
    private readonly loginAdminUseCase: LoginAdminUseCase,
    @Inject(VerifyTwoFactorUseCase)
    private readonly verifyTwoFactorUseCase: VerifyTwoFactorUseCase,
    @Inject(RefreshTokenUseCase)
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @Inject(LogoutUseCase)
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() body: LoginAdminRequestDto) {
    return this.loginAdminUseCase.execute(body);
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('verify-2fa')
  verifyTwoFactor(
    @Body() body: VerifyTwoFactorRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.verifyTwoFactorUseCase.execute({
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  refresh(@Body() body: RefreshTokenRequestDto) {
    return this.refreshTokenUseCase.execute(body.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@CurrentUserDecorator() user: CurrentUser): Promise<{ success: true }> {
    await this.logoutUseCase.execute(user.sessionId, user.sub);
    return { success: true };
  }
}
