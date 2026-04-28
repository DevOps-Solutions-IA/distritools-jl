import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CreateAdminUserUseCase } from 'src/modules/users/application/use-cases/create-admin-user.use-case';
import { DeactivateAdminUserUseCase } from 'src/modules/users/application/use-cases/deactivate-admin-user.use-case';
import { GetAdminUserUseCase } from 'src/modules/users/application/use-cases/get-admin-user.use-case';
import { UpdateAdminUserUseCase } from 'src/modules/users/application/use-cases/update-admin-user.use-case';
import { CreateAdminUserRequestDto } from 'src/modules/users/infrastructure/http/dto/create-admin-user.request.dto';
import { UpdateAdminUserRequestDto } from 'src/modules/users/infrastructure/http/dto/update-admin-user.request.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('admin/users')
export class UsersController {
  constructor(
    private readonly createAdminUserUseCase: CreateAdminUserUseCase,
    private readonly updateAdminUserUseCase: UpdateAdminUserUseCase,
    private readonly deactivateAdminUserUseCase: DeactivateAdminUserUseCase,
    private readonly getAdminUserUseCase: GetAdminUserUseCase,
  ) {}

  @Permissions('users.create')
  @Post()
  create(
    @Body() body: CreateAdminUserRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createAdminUserUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('users.read')
  @Get(':id')
  getOne(@Param('id') userId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getAdminUserUseCase.execute({ actor, userId });
  }

  @Permissions('users.update')
  @Patch(':id')
  update(
    @Param('id') userId: string,
    @Body() body: UpdateAdminUserRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateAdminUserUseCase.execute({
      actor,
      userId,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('users.deactivate')
  @Patch(':id/deactivate')
  deactivate(
    @Param('id') userId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.deactivateAdminUserUseCase.execute({
      actor,
      userId,
      ipAddress,
      userAgent,
    });
  }
}
